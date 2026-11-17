import { markCourseStep } from "@/app/course-actions";
import type { SavedCourseStep } from "@/lib/course";

export function CourseStepAction({ courseId, step }: { courseId: string; step: SavedCourseStep }) {
  return <form action={markCourseStep}>
    <input type="hidden" name="course_id" value={courseId} />
    <input type="hidden" name="step_id" value={step.row_id} />
    <input type="hidden" name="state" value={step.completed_at ? "reopen" : "studied"} />
    <button className="button button-light" aria-label={`${step.completed_at ? "Reopen" : "Mark done"} ${step.id}`}>
      {step.completed_at ? "Reopen" : "Mark done"}
    </button>
  </form>;
}
