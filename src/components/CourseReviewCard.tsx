"use client";
import { useState } from "react";
import type { Course } from "@/lib/course";
import { courseReviewPrompt } from "@/lib/course-review";
import { CourseLessonCard } from "./CourseLessonCard";

export function CourseReviewCard({ course }: { course: Course }) {
  const [request, setRequest] = useState("");
  return <section className="panel"><details><summary>Review outline with ChatGPT</summary>
    <p>Use this request in the chat that created the outline to check scope, prerequisites and assessment setup before lessons begin.</p>
    <label htmlFor="review-request">Original learning request (optional)</label>
    <textarea id="review-request" className="input" rows={3} value={request} onChange={event => setRequest(event.target.value)} />
    <p>Include your original request if it is unavailable in that chat. The generated course goal may differ from what you asked for.</p>
    <CourseLessonCard key={request} text={courseReviewPrompt(course, request)} />
    <p>Import a revised outline through Inbox. It is saved as a separate course; existing lessons and progress stay with the original. An AI review does not certify completeness.</p>
  </details></section>;
}
