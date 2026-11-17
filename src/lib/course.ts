import type { ExportManifest } from "./library-pack.ts";

export type CourseModule = { id: string; title: string; outcome: string; proof: string; needs: string[]; sources: string[]; steps_estimate: number };
export type Course = { format: "study-course/1"; export_id: string; title: string; goal: string; target: string; assumed_level: string; modules: CourseModule[]; not_covered: { id: string; why: string }[]; open_questions: string[] };

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected a JSON object.");
  return value as Record<string, unknown>;
}

function text(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) throw new Error("Course text fields must be nonempty strings.");
  return value;
}
function strings(value: unknown): string[] {
  if (!Array.isArray(value)) throw new Error("Expected a list of text values.");
  return value.map(text);
}
export function readCourse(raw: string): Record<string, unknown> & { export_id: string } {
  if (raw.length > 300000) throw new Error("Course text exceeds 300,000 characters.");
  const blocks = [...raw.matchAll(/^```(?:study-course|json)\s*\r?\n([\s\S]*?)^```\s*$/gm)];
  if (blocks.length > 1) throw new Error("Import one complete course JSON object at a time.");
  const value = object(JSON.parse(blocks.length ? blocks[0][1] : raw));
  if (value.format !== "study-course/1" || typeof value.export_id !== "string" || !/^X[a-f0-9]{64}$/.test(value.export_id))
    throw new Error("Expected a study-course object with a saved Library export ID.");
  return value as Record<string, unknown> & { export_id: string };
}

export function parseCourse(input: unknown, manifest: ExportManifest): { course: Course; unassigned: string[] } {
  const value = object(input);
  if (value.format !== "study-course/1" || value.export_id !== manifest.export_id) throw new Error("Course format or export ID does not match this saved export.");
  if (!Array.isArray(value.modules) || !value.modules.length || !Array.isArray(value.not_covered)) throw new Error("Provide modules and a not_covered list.");
  const known = new Set(manifest.items.map((item) => item.id)), seen = new Set<string>(), used = new Set<string>();
  const modules = value.modules.map((rawModule) => {
    const entry = object(rawModule), id = text(entry.id), needs = strings(entry.needs), sources = strings(entry.sources);
    if (seen.has(id) || needs.some((need) => !seen.has(need))) throw new Error("Module IDs must be unique and prerequisites must appear earlier.");
    if (!sources.length || sources.some((source) => source !== "general" && !known.has(source))) throw new Error("A module cites an unknown item or a map instead of source evidence.");
    if (!Number.isSafeInteger(entry.steps_estimate) || (entry.steps_estimate as number) < 1) throw new Error("Use a positive integer for steps_estimate.");
    seen.add(id); sources.forEach((source) => used.add(source));
    return { id, title: text(entry.title), outcome: text(entry.outcome), proof: text(entry.proof), needs, sources, steps_estimate: entry.steps_estimate as number };
  });
  const omitted = new Set<string>();
  const not_covered = value.not_covered.map((rawItem) => {
    const item = object(rawItem), id = text(item.id);
    if (!known.has(id) || used.has(id) || omitted.has(id)) throw new Error("An exclusion must be a known, unused item listed once.");
    omitted.add(id); return { id, why: text(item.why) };
  });
  return { course: { format: "study-course/1", export_id: manifest.export_id, title: text(value.title), goal: text(value.goal), target: text(value.target),
    assumed_level: text(value.assumed_level), modules, not_covered, open_questions: strings(value.open_questions) },
    unassigned: [...known].filter((id) => !used.has(id) && !omitted.has(id)) };
}
