import test from "node:test";
import assert from "node:assert/strict";
import { courseOverview } from "../src/lib/course-overview.ts";
import type { Course, SavedCourseStep } from "../src/lib/course.ts";

const course: Course = { format: "study-course/1", export_id: "X", title: "Course", goal: "Build independently", target: "A project", assumed_level: "Beginner",
  modules: ["M1", "M2"].map(id => ({ id, title: id, outcome: "Build", proof: "Independent exercise", needs: [], sources: ["general"], steps_estimate: 8 })),
  not_covered: [], open_questions: [] };
function step(module: string, completed: boolean): SavedCourseStep {
  return { id: `${module}.S1`, row_id: module, module_key: module, position: 1, kind: "exercise", goal: "Practice", sources: ["general"], done_when: "Works", completed_at: completed ? "2026-01-01" : null };
}

test("course estimates use actual plans where available and outline counts only for unplanned modules", () => {
  const result = courseOverview(course, [step("M1", true)], 30, 7);
  assert.equal(result.completedModules, 1);
  assert.equal(result.unplannedModules, 1);
  assert.equal(result.completedLessons, 1);
  assert.equal(result.plannedLessons, 1);
  assert.equal(result.remainingLessons, 8);
  assert.equal(result.remainingHours, 4);
  assert.equal(result.calendarDays, 4);
});

test("changing study pace changes the estimate without changing completion", () => {
  const steps = [step("M1", false), step("M2", true)];
  const slow = courseOverview(course, steps, 60, 1);
  const quick = courseOverview(course, steps, 30, 14);
  assert.equal(slow.remainingLessons, 1);
  assert.equal(slow.calendarDays, 7);
  assert.equal(quick.remainingHours, 0.5);
  assert.equal(quick.calendarDays, 1);
  assert.equal(quick.completedLessons, slow.completedLessons);
});

test("finished plans have no remaining time and missing study hours do not invent a deadline", () => {
  const completed = courseOverview(course, [step("M1", true), step("M2", true)], 30, 5);
  assert.equal(completed.completedModules, 2);
  assert.equal(completed.remainingHours, 0);
  assert.equal(completed.calendarDays, 0);
  const unplanned = courseOverview(course, [], 30, null);
  assert.equal(unplanned.calendarDays, null);
  assert.equal(unplanned.remainingHours, 8);
});
