"use client";

import { useActionState } from "react";
import { markCourseStep } from "@/app/course-actions";
import type { SavedCourseStep } from "@/lib/course";

export function CourseStepAction({ courseId, step }: { courseId: string; step: SavedCourseStep }) {
  const [error, save, pending] = useActionState(markCourseStep, "");
  return <form action={save}>
    <input type="hidden" name="course_id" value={courseId} />
    <input type="hidden" name="step_id" value={step.row_id} />
    <input type="hidden" name="state" value={step.completed_at ? "reopen" : "studied"} />
    <button className="button button-light" disabled={pending} aria-label={pending ? "Saving lesson progress" : `${step.completed_at ? "Reopen" : "Mark done"} ${step.id}`}>
      {pending ? "Saving…" : step.completed_at ? "Reopen" : "Mark done"}
    </button>
    {error && <p role="alert">{error}</p>}
  </form>;
}
