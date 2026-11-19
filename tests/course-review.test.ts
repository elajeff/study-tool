import test from "node:test";
import assert from "node:assert/strict";
import { courseReviewPrompt } from "../src/lib/course-review.ts";
import type { Course } from "../src/lib/course.ts";

test("curriculum review separates learner intent from the authored goal and retains the complete proposal", () => {
  const course: Course = {
    format: "study-course/1", export_id: "version-one", title: "Proposed course", goal: "A broader authored goal", target: "Beginner", assumed_level: "Not assessed",
    modules: [{ id: "M01", title: "Foundation", outcome: "Explain a concept", needs: [], sources: ["R1/F001"], proof: "Complete a supplied task", steps_estimate: 5 }],
    not_covered: [{ id: "R1/F002", why: "Unavailable explanation" }], open_questions: ["Required setup is uncertain"],
  };
  const request = 'A narrower goal with "quotes"\nand a second line';
  const prompt = courseReviewPrompt(course, request);
  assert.ok(prompt.includes(JSON.stringify(request)));
  assert.ok(prompt.includes("exact Library export version-one"));
  assert.deepEqual(JSON.parse(prompt.split("PROPOSED COURSE (reference JSON):\n")[1]), course);
  const withoutRequest = courseReviewPrompt(course, " ");
  assert.ok(!withoutRequest.includes("ORIGINAL REQUEST (reference text)"));
});
