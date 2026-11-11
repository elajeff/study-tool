import Link from "next/link";
import { ArrowRight, BookOpen, CheckCircle2, ChevronRight, NotebookPen, RotateCcw } from "lucide-react";
import { loadStudy } from "@/lib/study";
import { nextLesson, topicPath } from "@/lib/curriculum";
import { ProgressExport } from "@/components/ProgressExport";
import { latestApproved, demonstratedLessons, progressStats, isDueForReview } from "@/lib/progress";

import { loadAssessments } from "@/lib/assessment-queries";

export default async function DashboardPage() {
  const { supabase, profile, lessons, tracks, issues } = await loadStudy();
  const [receipts, { count: noteCount }] = await Promise.all([
    loadAssessments(supabase, "approved"),
    supabase.from("notes").select("id", { head: true, count: "exact" }),
  ]);
  const latest = latestApproved(receipts);
  const demonstrated = demonstratedLessons(lessons, latest);
  const stats = progressStats(lessons, latest);
  const next = nextLesson(lessons, demonstrated);
  const review = lessons.map((lesson) => ({ lesson, assessment: latest.get(topicPath(lesson.sourcePath)) }))
    .filter((row) => row.assessment && isDueForReview(row.assessment)).slice(0, 3);
  return <>
    <div className="page-heading">
      <h1>Dashboard</h1>
      {lessons.length > 0 && <div style={{ marginTop: 18 }}><ProgressExport rows={lessons.map((lesson) => {
        const record = latest.get(topicPath(lesson.sourcePath));
        return { title: lesson.title, path: topicPath(lesson.sourcePath), level: record?.level ?? null, date: record?.date ?? null };
      })} /></div>}
    </div>
    {issues.length > 0 && <section className="panel" role="alert"><h2>Check your source notes</h2>
      {issues.map((issue) => <p key={issue}>{issue}</p>)}<Link href="/notes" className="text-link">Open notes</Link></section>}
    {!profile ? <section className="panel next-panel"><h2>Learning goals not set</h2><p>Add your starting knowledge and learning goals in Settings.</p><Link className="button button-dark" href="/settings">Set learning goals <ArrowRight size={16} /></Link></section>
      : !lessons.length && !issues.length ? <section className="panel next-panel"><h2>No study topics</h2><p>Import Markdown from Obsidian or create notes here.</p><Link className="button button-dark" href="/notes">Import notes <ArrowRight size={16} /></Link></section>
      : <>
        <div className="stat-grid">
          <div className="stat"><span>Topics assessed</span><strong>{stats.assessed}<small> / {stats.total}</small></strong></div>
          <div className="stat"><span>Demonstrated (level 3+)</span><strong>{stats.demonstrated}</strong></div>
          <div className="stat"><span>Notes</span><strong>{noteCount ?? 0}</strong></div>
        </div>
        <div className="dashboard-grid">
          <section className="panel next-panel"><div className="panel-kicker"><BookOpen size={17} /> Next topic</div>
            {next ? <><h2>{next.title}</h2><p>{next.summary}</p>
              <div className="lesson-meta">{tracks.find((t) => t.id === next.track)?.title} · {next.prerequisites.length} prerequisite{next.prerequisites.length === 1 ? "" : "s"}</div>
              <Link className="button button-dark" href={`/curriculum/${next.id}`}>Open lesson <ArrowRight size={16} /></Link></>
              : <><h2>{demonstrated.size === lessons.length && !issues.length ? "All topics demonstrated" : "Prerequisites need attention"}</h2><p>{demonstrated.size === lessons.length && !issues.length ? "All current topics have approved assessments at level 3 or higher." : "Check the roadmap and source notes before choosing the next topic."}</p>
                <Link href="/curriculum" className="button button-dark">Open roadmap</Link></>}
          </section>
          <section className="panel"><div className="panel-head"><h2>Curriculum</h2><Link href="/curriculum" className="subtle-link">See all <ArrowRight size={15} /></Link></div>
            <div className="track-list">{tracks.map((track, i) => {
              const own = lessons.filter((lesson) => lesson.track === track.id);
              const count = own.filter((lesson) => demonstrated.has(lesson.id)).length;
              return <Link href={`/curriculum#${track.id}`} className="track-row" key={track.id}>
                <span className="track-circle">{count === own.length ? <CheckCircle2 size={18} /> : String(i + 1).padStart(2, "0")}</span>
                <span><strong>{track.title}</strong><small>{count} of {own.length} at level 3+</small></span><ChevronRight size={17} />
              </Link>;
            })}</div>
          </section>
        </div>
        <section className="panel lower-panel"><div className="panel-head"><h2>Notes and review</h2><Link href="/assessments" className="subtle-link">Assessments <ArrowRight size={15} /></Link></div>
          <div className="quick-grid"><div><NotebookPen size={24} /><h3>Source notes</h3><p>Edit or import source notes on the Notes page.</p></div>
            <div><RotateCcw size={24} /><h3>Review due</h3><p>{review.length ? review.map(({ lesson }) => lesson.title).join(", ") : "No reviews due."}</p></div>
          </div>
        </section>
      </>}
  </>;
}
