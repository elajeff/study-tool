"use client";
import { useActionState } from "react";
import { saveStudyPace } from "@/app/pace-actions";
import type { StudyPace } from "@/lib/study-pace";

export function StudyPaceForm({ pace }: { pace: StudyPace }) {
  const [state, action, pending] = useActionState(saveStudyPace, null);
  return <form action={action} className="stack">
    <label htmlFor="daily-hours">Hours per study day</label><input className="input" id="daily-hours" name="daily-hours" type="number" min={0.1} max={16} step="any" defaultValue={pace.hoursPerDay} required disabled={pending} />
    <label htmlFor="study-days">Study days per week</label><input className="input" id="study-days" name="days" type="number" min={1} max={7} defaultValue={pace.daysPerWeek} required disabled={pending} />
    <label htmlFor="lesson-minutes">Estimated minutes per lesson</label><input className="input" id="lesson-minutes" name="minutes" type="number" min={5} max={240} defaultValue={pace.minutesPerLesson} required disabled={pending} />
    {state?.error && <p role="alert">{state.error}</p>}
    <button className="button button-light" disabled={pending}>{pending ? "Saving…" : "Save study pace"}</button>
    <p className="muted small">Saved for this account in this browser. Until saved, the estimate uses weekly hours from Settings and 30 minutes per lesson.</p>
  </form>;
}
