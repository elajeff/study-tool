import type { SupabaseClient } from "@supabase/supabase-js";
import type { InboxBlock } from "./inbox.ts";
import { parseCourse, parseModule, type Course, type ModulePlan } from "./course.ts";
import { parseDigest, type DigestBlock } from "./library-digest.ts";
import { validateEvidence, evidenceFingerprint, type Evidence } from "./assessments.ts";
import { loadExportManifest } from "./export-queries.ts";
import type { ExportManifest } from "./library-pack.ts";

export type InboxImport = { kind: "course"; course: Course } | { kind: "module"; course_id: string; plan: ModulePlan }
  | { kind: "digest"; export_id: string; items: DigestBlock["items"] }
  | { kind: "evidence"; receipt: Evidence; fingerprint: string };
export type InboxResult = { kind: "course" | "module"; id: string; course_id: string; created?: boolean; module?: string }
  | { kind: "digest"; export_id: string; new_items: number } | { kind: "evidence"; id: string; created: boolean };

export async function prepareInboxImport(client: SupabaseClient, blocks: InboxBlock[], legacyTopics: Set<string> = new Set()): Promise<InboxImport[]> {
  const manifests = new Map<string, ExportManifest>(), courses = new Map<string, Course>();
  async function manifest(id: unknown) {
    if (typeof id !== "string" || !/^X[a-f0-9]{64}$/.test(id)) throw new Error("Use the export_id supplied in the Library instructions.");
    if (!manifests.has(id)) {
      const saved = await loadExportManifest(client, id);
      if (!saved) throw new Error("Library snapshot not found in this account.");
      manifests.set(id, saved);
    }
    return manifests.get(id)!;
  }
  const prepared: InboxImport[] = [];
  for (const block of blocks) {
    const value = block.value;
    if (block.kind === "course") prepared.push({ kind: "course", course: parseCourse(value, await manifest(value.export_id)).course });
    else if (block.kind === "digest") {
      const digest = parseDigest(JSON.stringify(value), await manifest(value.export_id));
      prepared.push({ kind: "digest", export_id: digest.export_id, items: digest.items });
    } else if (block.kind === "module") {
      const id = value.course_id;
      if (typeof id !== "string" || !/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id)) throw new Error("Use the saved course_id from a module card. Import the outline first.");
      if (!courses.has(id)) {
        const { data, error } = await client.from("courses").select("raw_block,export_id").eq("id", id).single();
        if (error) throw new Error("Saved course not found. Import the outline before requesting a module.");
        courses.set(id, parseCourse(data.raw_block, await manifest(data.export_id)).course);
      }
      const course = courses.get(id)!;
      const moduleId = String(value.module ?? "");
      const snapshot = await manifest(course.export_id);
      try { prepared.push({ kind: "module", course_id: id, plan: parseModule(JSON.stringify(value), id, course, moduleId, snapshot) }); }
      catch (error) { throw new Error(`${moduleId || "Module plan"}: ${error instanceof Error ? error.message : "Invalid module plan."}`); }
    } else {
      const receipt = validateEvidence(value);
      prepared.push({ kind: "evidence", receipt, fingerprint: evidenceFingerprint(receipt) });
    }
  }
  const receipts = prepared.flatMap(block => block.kind === "evidence" ? [block.receipt] : []);
  const stepIds = [...new Set(receipts.flatMap(receipt => receipt.step ? [receipt.step] : []))];
  const steps = new Set<string>();
  if (stepIds.length) {
    const { data, error } = await client.from("course_steps").select("id").in("id", stepIds);
    if (error) throw new Error("Could not load assessment steps.");
    data.forEach(step => steps.add(step.id));
  }
  if (receipts.some(receipt => receipt.step ? !steps.has(receipt.step) : !legacyTopics.has(receipt.topic)))
    throw new Error("Assessment topic or saved step is not available in this account.");
  return prepared;
}
