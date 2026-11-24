import test from "node:test";
import assert from "node:assert/strict";
import { lessonStudyCard } from "../src/lib/lesson-request.ts";
import type { Course, SavedCourseStep } from "../src/lib/course.ts";
import { PROJECT_INSTRUCTIONS } from "../src/lib/library-pack.ts";

test("lesson requests identify one saved step, its sources and prerequisites and require practice before continuing", () => {
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
  for (const prompt of [card, PROJECT_INSTRUCTIONS]) {
    assert.match(prompt, /concrete example.*fresh independent exercise.*Wait for their attempt.*specific feedback.*Move to the next lesson only after/s);
    assert.doesNotMatch(prompt, /study-evidence/);
  }
});
