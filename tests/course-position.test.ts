import test from "node:test";
import assert from "node:assert/strict";
import { coursePositionToResume, savedCoursePosition } from "../src/lib/course-position.ts";
import type { Course, SavedCourseStep } from "../src/lib/course.ts";

const course = { modules: [{ id: "M1" }, { id: "M2" }] } as Course;
const steps = [{ row_id: "step", module_key: "M2" }] as SavedCourseStep[];
test("resume restores a saved module and only a step belonging to it", () => {
  assert.equal(savedCoursePosition("course.1.step", "course", course, steps)?.step, steps[0]);
  assert.equal(savedCoursePosition("course.0.step", "course", course, steps)?.step, undefined);
  assert.equal(savedCoursePosition("course.0.", "course", course, steps)?.module.id, "M1");
});
test("resume ignores another course, missing modules and malformed positions", () => {
  for (const raw of [undefined, "other.1.step", "course.5.step", "course.-1.step", "course.invalid.step"])
    assert.equal(savedCoursePosition(raw, "course", course, steps), null);
});

test("Dashboard resumes unfinished work and does not reopen the final completed lesson", () => {
  const planned = [
    { ...steps[0], row_id: "first", module_key: "M1", position: 1, completed_at: "2026-11-19" },
    { ...steps[0], position: 1, completed_at: null },
  ];
  assert.equal(coursePositionToResume("course.0.first", "course", course, planned)?.step?.row_id, "step");
  planned[1].completed_at = "2026-11-20";
  assert.equal(coursePositionToResume("course.1.step", "course", course, planned), null);
});
