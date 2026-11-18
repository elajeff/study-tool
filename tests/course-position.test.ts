import test from "node:test";
import assert from "node:assert/strict";
import { savedCoursePosition } from "../src/lib/course-position.ts";
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
