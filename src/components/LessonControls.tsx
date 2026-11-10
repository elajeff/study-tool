"use client";
import { saveProgress } from "@/app/actions";
import type { Lesson } from "@/lib/curriculum";
import type { Progress } from "@/lib/progress";

export function LessonControls({ lesson, progress }: { lesson: Lesson; progress?: Progress }) {
  // Using a regular server action keeps persistence on the server and the form easy to understand.
  return <section className="panel progress-panel"><h3>Your progress</h3><p className="muted small">Keep this honest. These are your own records, not an AI-graded assessment.</p>
    <form action={saveProgress} className="stack"><input type="hidden" name="lessonId" value={lesson.id} />
      <label htmlFor="status">Lesson status</label><select id="status" name="status" className="input" defaultValue={progress?.status ?? "not_started"}><option value="not_started">Not started</option><option value="studying">Studying</option><option value="completed">Completed an exercise</option></select>
      <label htmlFor="mastery">Self-assessed mastery</label><select id="mastery" name="mastery" className="input" defaultValue={progress?.mastery ?? 0}>{["0 — New to this", "1 — I recognize it", "2 — I can explain it", "3 — I can solve a small task", "4 — I can implement it alone", "5 — I can apply it in new situations"].map((label, i) => <option value={i} key={label}>{label}</option>)}</select>
      <label htmlFor="reflection">What did you try or learn?</label><textarea id="reflection" name="reflection" className="input" rows={4} maxLength={3000} defaultValue={progress?.reflection ?? ""} placeholder="What worked? What still confuses you?" />
      <button type="submit" className="button button-dark button-wide">Save progress</button>
    </form>
  </section>;
}
