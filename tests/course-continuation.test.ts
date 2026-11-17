import test from "node:test";
import assert from "node:assert/strict";
import { nextCourseLesson, type Course, type SavedCourseStep } from "../src/lib/course.ts";

test("continuation follows outline and step order, stops at unplanned modules, and respects reopening", () => {
  const course: Course = { format: "study-course/1", export_id: "X" + "a".repeat(64), title: "Ratios", goal: "Learn", target: "Solve", assumed_level: "Beginner",
    modules: ["M01", "M02", "M03"].map(id => ({ id, title: id, outcome: "Explain", proof: "Solve a fresh case", needs: [], sources: ["general"], steps_estimate: 5 })),
    not_covered: [], open_questions: [] };
  const steps: SavedCourseStep[] = ["M03", "M01"].flatMap(module_key => [2, 1].map(position => ({
    id: `${module_key}.S${position}`, row_id: `${module_key}-${position}`, module_key, position, kind: "exercise",
    goal: "Compare ratios", sources: ["general"], done_when: "Explain without hints", completed_at: null,
  })));
  assert.equal(nextCourseLesson(course, steps)?.step?.id, "M01.S1");
  steps.find(step => step.id === "M01.S1")!.completed_at = "2026-11-17T12:00:00Z";
  assert.equal(nextCourseLesson(course, steps)?.step?.id, "M01.S2");
  steps.find(step => step.id === "M01.S2")!.completed_at = "2026-11-17T12:00:00Z";
  assert.equal(nextCourseLesson(course, steps)?.module.id, "M02");
  assert.equal(nextCourseLesson(course, steps)?.step, undefined);
  steps.push(...steps.filter(step => step.module_key === "M01").map(step => ({ ...step, module_key: "M02", id: step.id.replace("M01", "M02"), row_id: step.row_id.replace("M01", "M02") })));
  assert.equal(nextCourseLesson(course, steps)?.step?.id, "M03.S1");
  steps.forEach(step => { step.completed_at = "2026-11-17T12:00:00Z"; });
  assert.equal(nextCourseLesson(course, steps), null);
  steps[0].completed_at = null;
  assert.equal(nextCourseLesson(course, steps)?.step?.id, "M03.S2");
  assert.equal(nextCourseLesson(course, [])?.module.id, "M01");
});
