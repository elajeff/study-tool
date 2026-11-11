import Link from "next/link";
import type { Assessment } from "@/lib/progress";
import { reviewDate } from "@/lib/progress";

export function LessonControls({ assessment }: { assessment?: Assessment }) {
  return <section className="panel progress-panel">
    <h3>Mastery</h3>
    <p className="muted small">Only approved assessments count toward your score.</p>
    <p><strong>{assessment ? `Level ${assessment.level} / 5` : "Not assessed"}</strong></p>
    {assessment && <>
      <p className="small">Last assessed: {assessment.date}</p>
      <p className="small">Review from {reviewDate(assessment)}</p>
      {assessment.next_step && <p className="small">Next: {assessment.next_step}</p>}
    </>}
    <Link href="/assessments" className="button button-dark button-wide">Review an assessment</Link>
  </section>;
}
