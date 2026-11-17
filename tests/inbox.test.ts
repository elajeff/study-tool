import test from "node:test";
import assert from "node:assert/strict";
import { parseInbox } from "../src/lib/inbox.ts";
import { prepareInboxImport } from "../src/lib/inbox-import.ts";
import { createClient } from "@supabase/supabase-js";

const exportId = "X" + "a".repeat(64);
const course = { format: "study-course/1", export_id: exportId, title: "Seeds", goal: "Grow", target: "Grow independently", assumed_level: "Beginner",
 modules: [{ id: "M01", title: "First", outcome: "Sow", proof: "Sow alone", needs: [], sources: ["V1/N001"], steps_estimate: 3 }], not_covered: [], open_questions: [] };
const digest = { format: "study-digest/1", export_id: exportId, items: [{ id: "V1/N001", summary: 'Keep the exact punctuation ,} and \"quotes\".' }] };

test("module intake accepts its own plan and summaries while rejecting a different workflow or identity", () => {
 const expected = { courseId: "saved-course", moduleId: "M01" };
 const plan = { format: "study-module/1", course_id: expected.courseId, module: "M01", export_id: exportId };
 const fence = (value: unknown) => `\`\`\`json\n${JSON.stringify(value)}\n\`\`\``;
 assert.deepEqual(parseInbox(fence(plan) + "\n" + fence(digest), expected).blocks.map(block => block.kind), ["module", "digest"]);
 for (const wrong of [course, { ...plan, course_id: "other-course" }, { ...plan, module: "M02" }])
  assert.throws(() => parseInbox(fence(wrong), expected), /Nothing was saved/);
 assert.throws(() => parseInbox(fence(plan) + "\n" + fence({ ...digest, export_id: "other" }), expected), /Nothing was saved/);
});

test("Inbox finds multiple supported fences and removes trailing commas without altering quoted text", () => {
 const raw = `Prose\n\`\`\`json\n${JSON.stringify(course)}\n\`\`\`\n\`\`\`study-digest\n${JSON.stringify(digest).replace(/}$/, ',}')}\n\`\`\`\n\`\`\`json\n{"ordinary":1}\n\`\`\``;
 const parsed = parseInbox(raw);
 assert.deepEqual(parsed.blocks.map(block => block.kind), ["course", "digest"]);
 assert.equal(parsed.blocks[1].value.items && JSON.stringify(parsed.blocks[1].value), JSON.stringify(digest));
 assert.equal(parsed.ignored, 1);
 assert.equal(parseInbox(JSON.stringify(course)).blocks[0].kind, "course");
});

test("truncated or mislabeled blocks cannot be silently skipped; nested code examples are not imports", () => {
 for (const text of [`\`\`\`study-course\n${JSON.stringify(course)}`, `\`\`\`study-course\n{\n\`\`\``, `\`\`\`study-digest\n${JSON.stringify(course)}\n\`\`\``])
  assert.throws(() => parseInbox(text), /closed|JSON|disagrees/);
 const nested = `\`\`\`\`markdown\n\`\`\`json\n${JSON.stringify(course)}\n\`\`\`\n\`\`\`\`\n`;
 assert.throws(() => parseInbox(nested), /No supported/);
 assert.throws(() => parseInbox(`\`\`\`json\n${JSON.stringify(course)}\n\`\`\`\n\`\`\`study-course\n[]\n\`\`\``), /JSON object/);
 assert.throws(() => parseInbox(`\`\`\`json\n${JSON.stringify(course)}\n\`\`\`\n\`\`\`json\n{"format":"study-future/1"}\n\`\`\``), /Unsupported/);
 assert.throws(() => parseInbox("\0".repeat(1024*1024+1)), /at most 1 MiB/);
 assert.throws(() => parseInbox(Array(21).fill(`\`\`\`json\n${JSON.stringify(course)}\n\`\`\``).join("\n")), /at most 20/);
});

test("mixed imports reuse existing validators and one exact saved manifest; no writes happen during preparation", async () => {
 const requests: URL[] = [];
 const manifest = { format: "study-export/3", export_id: exportId, sources: [], maps: [], items: [{ id: "V1/N001" }] };
 const client = createClient("http://example.test", "fixture", { auth: { persistSession: false }, global: { fetch: async (input, init) => {
  const url = new URL(String(input)); requests.push(url); assert.equal(init?.method, "GET");
  return new Response(JSON.stringify({ manifest }), { headers: { "Content-Type": "application/json" } });
 } } });
 const parsed = [{ kind: "course" as const, value: course }, { kind: "digest" as const, value: digest }];
 const prepared = await prepareInboxImport(client, parsed);
 assert.deepEqual(prepared.map(block => block.kind), ["course", "digest"]);
 assert.equal(requests.length, 1);
 await assert.rejects(prepareInboxImport(client, [{ kind: "digest", value: { ...digest, items: [{ id: "V1/N999", summary: "Unknown" }] } }]), /IDs/);
});

test("module and evidence preparation requires owned saved identities and rejects a missing snapshot", async () => {
 const courseId = "00000000-0000-4000-8000-000000000001", stepId = "00000000-0000-4000-8000-000000000002";
 const plan = { format: "study-module/1", course_id: courseId, export_id: exportId, module: "M01", steps: [{ id: "M01.S1", kind: "exercise", goal: "Sow seeds", sources: ["general"], done_when: "Explain without hints" }] };
 const receipt = { topic: `course-step:${stepId}`, step: stepId, date: "2026-11-17", level: 2, task: "Explain seeds", evidence: "Explained a new example with guidance.", independent: false, hints: "major", artifact: "", next_step: "Try alone" };
 let available = true;
 const client = createClient("http://example.test", "fixture", { auth: { persistSession: false }, global: { fetch: async (input, init) => {
  assert.equal(init?.method, "GET");
  const path = new URL(String(input)).pathname;
  return Response.json(path.endsWith("course_steps") ? available ? [{ id: stepId }] : [] : path.endsWith("courses") ? { raw_block: course, export_id: exportId }
   : available ? { manifest: { format: "study-export/3", export_id: exportId, sources: [], maps: [], items: [{ id: "V1/N001" }] } } : null);
 } } });
 const prepared = await prepareInboxImport(client, [{ kind: "module", value: plan }, { kind: "evidence", value: receipt }]);
 assert.deepEqual(prepared.map(item => item.kind), ["module", "evidence"]);
 available = false;
 await assert.rejects(prepareInboxImport(client, [{ kind: "course", value: course }]), /snapshot not found/);
 await assert.rejects(prepareInboxImport(client, [{ kind: "evidence", value: receipt }]), /not available/);
});
