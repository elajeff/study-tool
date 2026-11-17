import test from "node:test";
import assert from "node:assert/strict";
import { parseCourse, readCourse } from "../src/lib/course.ts";
import type { ExportManifest } from "../src/lib/library-pack.ts";

const manifest: ExportManifest = { format: "study-export/3", export_id: "X" + "a".repeat(64), sources: [], maps: [{ id: "R1/MAP/1", text: "Map" }],
  items: ["F001", "F002"].map(id => ({ id: `R1/${id}`, source_id: "source", artifact_id: id, revision_id: `revision-${id}`, path: `${id}.py`, content_hash: "fixture" })) };
const course = { format: "study-course/1", export_id: manifest.export_id, title: "Synthetic course", goal: "Learn a new subject", target: "Build independently", assumed_level: "Beginner",
  modules: [{ id: "M01", title: "Foundations", outcome: "Explain the rules", proof: "Solve a changed example without hints", needs: [], sources: ["R1/F001"], steps_estimate: 5 }],
  not_covered: [{ id: "R1/F002", why: "Outside this goal" }], open_questions: ["Which optional deployment target?"] };

test("course decoding handles one JSON block and preserves the saved export identity", () => {
  assert.deepEqual(parseCourse(readCourse(JSON.stringify(course)), manifest), { course, unassigned: [] });
  assert.deepEqual(readCourse('```study-course\n' + JSON.stringify(course) + '\n```'), course);
  assert.throws(() => readCourse('```json\n{}\n```\n```json\n{}\n```'), /one complete/);
  assert.throws(() => readCourse(JSON.stringify({ ...course, export_id: "unknown" })), /export ID/);
  assert.throws(() => parseCourse({ ...course, export_id: "other" }, manifest), /does not match/);
});

test("course references, prerequisite order and exclusions are checked without treating coverage as mastery", () => {
  const foundation = course.modules[0];
  for (const invalid of [
    { ...course, modules: [] }, { ...course, modules: [foundation, foundation] },
    { ...course, modules: [{ ...foundation, needs: ["M01"] }] },
    { ...course, modules: [{ ...foundation, sources: ["R1/MAP/1"] }] },
    { ...course, modules: [{ ...foundation, sources: ["R1/F999"] }] },
    { ...course, modules: [{ ...foundation, proof: "" }] },
    { ...course, modules: [{ ...foundation, steps_estimate: 0 }] },
    { ...course, not_covered: [{ id: "R1/F001", why: "Already cited" }] },
  ]) assert.throws(() => parseCourse(invalid, manifest));
  const general = parseCourse({ ...course, modules: [{ ...foundation, sources: ["general"] }], not_covered: [] }, manifest);
  assert.deepEqual(general.unassigned, ["R1/F001", "R1/F002"]);
  assert.deepEqual(parseCourse({ ...course, modules: [foundation, { ...foundation, id: "M02", needs: ["M01"] }] }, manifest).course.modules[1].needs, ["M01"]);
});
