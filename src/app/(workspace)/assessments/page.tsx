import { Check, X } from "lucide-react";
import { loadStudy } from "@/lib/study";
import { importAssessments, reviewAssessment } from "@/app/actions";
import type { Assessment } from "@/lib/progress";

import { loadAssessments } from "@/lib/assessment-queries";

export default async function AssessmentsPage() {
  const { supabase, lessons } = await loadStudy();
  const labels = new Map(lessons.map((lesson) => [lesson.topic, `${lesson.title} · ${lesson.sourceName}`]));
  const [pending, { data: history, error }] = await Promise.all([
    loadAssessments(supabase, "pending"),
    supabase.from("assessment_receipts").select("*").neq("status", "pending")
      .order("reviewed_at", { ascending: false }).order("id").limit(15),
  ]);
  if (error) throw new Error("Could not load assessment history.");
  const reviewed = (history ?? []) as Assessment[];
  const stepIds = [...new Set([...pending, ...reviewed].flatMap(record => record.step_id ? [record.step_id] : []))];
  for (let start = 0; start < stepIds.length; start += 100) {
    const { data, error } = await supabase.from("course_steps").select("id,key,goal").in("id", stepIds.slice(start, start + 100));
    if (error) throw new Error("Could not load assessment lesson labels.");
    data.forEach(step => labels.set(`course-step:${step.id}`, `${step.key} · ${step.goal}`));
  }
  return <>
    <div className="page-heading">
      <h1>Assessments</h1>
      <p>A score counts only when the evidence is approved. Check the exercise, hints, and original work before accepting a level.</p>
    </div>
    <section className="panel assessment-import">
      <h2>Add an assessment</h2>
      <p>Paste a <code>study-evidence</code> JSON block from a tutoring conversation. Imported receipts start as pending. Chat transcripts are not uploaded automatically.</p>
      <form action={importAssessments} className="stack">
        <label htmlFor="evidenceText">Assessment receipt</label>
        <textarea name="evidenceText" id="evidenceText" className="input" rows={8} required maxLength={300000}
          placeholder={'```study-evidence\n{\n  "topic": "Lessons/Java/06 Methods",\n  "date": "2026-11-10",\n  "level": 2,\n  "task": "Explain return values",\n  "evidence": "...",\n  "independent": false,\n  "hints": "major",\n  "artifact": "",\n  "next_step": "Write two methods"\n}\n```'} />
        <button type="submit" className="button button-dark">Import receipt</button>
      </form>
    </section>
    <section className="panel assessment-list">
      <h2>Pending review ({pending.length})</h2>
      {pending.length ? pending.map((record) => <article className="assessment-record" key={record.id}>
        <div className="assessment-heading"><strong>{labels.get(record.topic) ?? record.topic}</strong><span>Level {record.level} · {record.date}</span></div>
        <p><strong>Task:</strong> {record.task}</p>
        <p><strong>Evidence:</strong> {record.evidence}</p>
        <p><strong>Independent:</strong> {record.independent ? "Yes" : "No"} · <strong>Hints:</strong> {record.hints}</p>
        {record.artifact && <p><strong>Artifact:</strong> {record.artifact}</p>}
        {record.next_step && <p><strong>Next:</strong> {record.next_step}</p>}
        <div className="review-actions">
          <form action={reviewAssessment}><input type="hidden" name="id" value={record.id} />
            <input type="hidden" name="decision" value="approved" />
            <button className="button button-dark" type="submit"><Check size={16} /> Approve</button></form>
          <form action={reviewAssessment}><input type="hidden" name="id" value={record.id} />
            <input type="hidden" name="decision" value="rejected" />
            <button className="button button-light" type="submit"><X size={16} /> Reject</button></form>
        </div>
      </article>) : <p className="muted">No assessments awaiting review.</p>}
    </section>
    {reviewed.length > 0 && <section className="panel assessment-list">
      <h2>Recent decisions</h2>
      {reviewed.map((r) => <div className="assessment-history" key={r.id}>
        <span>{labels.get(r.topic) ?? r.topic}</span><span>{r.status === "approved" ? `Approved · level ${r.level}` : "Rejected"} · {r.date}</span>
      </div>)}
    </section>}
  </>;
}
