import test from "node:test";
import assert from "node:assert/strict";
import { lessonStudyCard } from "../src/lib/lesson-request.ts";
import type { Course, SavedCourseStep } from "../src/lib/course.ts";
import type { Assessment } from "../src/lib/progress.ts";

test("lesson requests identify one saved step, its sources and prerequisites without inventing mastery", () => {
  const course: Course = { format: "study-course/1", export_id: "X" + "a".repeat(64), title: "Ratios", goal: "Understand ratios", target: "Solve independently", assumed_level: "Beginner",
    modules: ["M01", "M02"].map((id, index) => ({ id, title: `Module ${index + 1}`, outcome: "Explain units", proof: "Solve a changed problem", needs: index ? ["M01"] : [], sources: ["general"], steps_estimate: 5 })),
    not_covered: [], open_questions: [] };
  const step: SavedCourseStep = { id: "M02.S2", row_id: "00000000-0000-4000-8000-000000000002", module_key: "M02", position: 2, completed_at: null,
    kind: "exercise", goal: "Compare two ratios", sources: ["V1/N001", "general"], done_when: "Explain the comparison without hints" };
  const card = lessonStudyCard("course-id", course, course.modules[1], step);
  const context = JSON.parse(card.split("REFERENCE DATA (JSON):\n")[1]);
  assert.equal(context.course_id, "course-id");
  assert.equal(context.export_id, course.export_id);
  assert.deepEqual(context.current_step, step);
  assert.equal(context.prerequisites[0].id, "M01");
  assert.match(card, /Teach only M02.S2 next/);
  assert.match(card, /Retrieve cited items and other relevant material yourself/);
  assert.match(card, /Wait for an attempt before giving its solution/);
  assert.equal(context.approved_assessment, null);
  assert.match(card, /reviewed report of demonstrated work, not machine verification/);
  assert.match(card, /Do not claim Study Tool has recorded completion/);
  assert.match(card, /app imports receipts as pending review/);
  assert.ok(card.includes(`topic "course-step:${step.row_id}", step "${step.row_id}"`));
  const assessment: Assessment = { id: "approved-record", topic: `course-step:${step.row_id}`, date: "2026-11-17", level: 2,
    task: "Compare fresh ratios", evidence: "Explained the units with hints.", independent: false, hints: "major", artifact: "", next_step: "Try without hints",
    status: "approved", submitted_at: "2026-11-17T12:00:00Z", reviewed_at: "2026-11-17T12:05:00Z" };
  const assessedContext = JSON.parse(lessonStudyCard("course-id", course, course.modules[1], step, assessment).split("REFERENCE DATA (JSON):\n")[1]);
  assert.equal(assessedContext.approved_assessment.id, assessment.id);
  assert.equal(assessedContext.approved_assessment.level, 2);
  assert.equal(assessedContext.approved_assessment.hints, "major");
  assert.equal(assessedContext.approved_assessment.next_step, assessment.next_step);
});
