import test from "node:test";
import assert from "node:assert/strict";
import { parseModule, type Course, type ModulePlan } from "../src/lib/course.ts";
import { modulePlanningCard } from "../src/lib/module-request.ts";
import type { ExportManifest } from "../src/lib/library-pack.ts";

const courseId = "00000000-0000-4000-8000-000000000001";
const manifest: ExportManifest = { format: "study-export/3", export_id: "X" + "a".repeat(64), sources: [], maps: [],
  items: ["R1/F001", "V1/N001"].map(id => ({ id, source_id: "fixture", artifact_id: id, revision_id: id, path: id, content_hash: "fixture" })) };
const course: Course = { format: "study-course/1", export_id: manifest.export_id, title: "Ratios", goal: "Understand ratios", target: "Solve independently", assumed_level: "Beginner",
  modules: ["M01", "M02"].map((id, index) => ({ id, title: `Module ${index + 1}`, outcome: "Explain and calculate", proof: "Solve a changed ratio with units", needs: index ? ["M01"] : [], sources: ["general"], steps_estimate: 5 })),
  not_covered: [], open_questions: [] };
const plan: ModulePlan = { format: "study-module/1", course_id: courseId, export_id: manifest.export_id, module: "M01",
  steps: [{ id: "M01.S1", kind: "example", goal: "Work through a ratio", sources: ["R1/F001", "V1/N001"], done_when: "Explain each unit conversion." }] };

test("module plans bind identities and ordered steps while allowing other relevant Library items", () => {
  assert.deepEqual(parseModule(JSON.stringify(plan), courseId, course, "M01", manifest), plan);
  assert.deepEqual(parseModule('```study-module\n' + JSON.stringify(plan) + '\n```', courseId, course, "M01", manifest), plan);
  for (const changed of [{ course_id: "other" }, { export_id: "other" }, { module: "M02" }, { steps: [] },
    { steps: [{ ...plan.steps[0], id: "M01.S2" }] }, { steps: [{ ...plan.steps[0], sources: ["V1/N999"] }] },
    { steps: [{ ...plan.steps[0], kind: "unknown" }] }])
    assert.throws(() => parseModule(JSON.stringify({ ...plan, ...changed }), courseId, course, "M01", manifest));
  const unicode = { ...plan, steps: Array.from({ length: 12 }, (_, index) => ({ ...plan.steps[0], id: `M01.S${index + 1}`, goal: "α".repeat(3000), done_when: "β".repeat(3000) })) };
  assert.equal(parseModule(JSON.stringify(unicode), courseId, course, "M01", manifest).steps.length, 12);
});

test("module requests carry real identities and scope without inventing assessed ability", () => {
  const card = modulePlanningCard(courseId, course, [course.modules[1]]);
  const schema = JSON.parse(card.split("\nExample object: ")[1].split(".\n")[0]);
  assert.equal(schema.course_id, courseId);
  assert.equal(schema.export_id, manifest.export_id);
  assert.equal(schema.module, "M02");
  const context = JSON.parse(card.split("REFERENCE DATA (JSON):\n")[1]);
  assert.equal(context.prerequisites[0].id, "M01");
  assert.match(card, /retrieve relevant source items yourself/);
  assert.match(card, /Do not issue assessment receipts/);
  assert.match(card, /Existing code or notes do not establish mastery/);
});
