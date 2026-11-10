import Link from "next/link";
import { ArrowRight, BookOpen, CheckCircle2, ChevronRight, NotebookPen, RotateCcw } from "lucide-react";
import { loadStudy } from "@/lib/study";
import { nextLesson, topicPath } from "@/lib/curriculum";
import { ProgressExport } from "@/components/ProgressExport";
import { latestApproved, demonstratedLessons, progressStats, isDueForReview, type Assessment } from "@/lib/progress";

export default async function DashboardPage() {
  const { supabase, user, profile, lessons, tracks } = await loadStudy();
  const [{ data: receipts, error }, { count: noteCount }] = await Promise.all([
    supabase.from("assessment_receipts").select("*").eq("status", "approved").order("date", { ascending: false }).limit(1000),
    supabase.from("notes").select("id", { head: true, count: "exact" }),
  ]);
  if (error) throw new Error("Could not load assessments. Apply the database migration first.");
  const latest = latestApproved((receipts ?? []) as Assessment[]);
  const demonstrated = demonstratedLessons(lessons, latest);
  const stats = progressStats(lessons, latest);
  const next = nextLesson(lessons, demonstrated);
  const review = lessons.map((lesson) => ({ lesson, assessment: latest.get(topicPath(lesson.sourcePath)) }))
    .filter((row) => row.assessment && isDueForReview(row.assessment)).slice(0, 3);
  const firstName = user.email?.split("@")[0] ?? "there";
  return <>
    <div className="page-heading"><span className="eyebrow">YOUR LEARNING SPACE</span>
      <h1>Good to see you, {firstName}.</h1>
      <p>Your roadmap comes from your notes and goals—not a course everyone has to follow.</p>
      {lessons.length > 0 && <div style={{ marginTop: 18 }}><ProgressExport rows={lessons.map((lesson) => {
        const record = latest.get(topicPath(lesson.sourcePath));
        return { title: lesson.title, path: topicPath(lesson.sourcePath), level: record?.level ?? null, date: record?.date ?? null };
      })} /></div>}
    </div>
    {!profile ? <section className="panel next-panel"><h2>What do you want to learn?</h2><p>Add your starting knowledge and goals to build a personal study path.</p><Link className="button button-dark" href="/settings">Set learning goals <ArrowRight size={16} /></Link></section>
      : !lessons.length ? <section className="panel next-panel"><h2>Bring in your notes.</h2><p>Import Markdown from Obsidian or create notes here.</p><Link className="button button-dark" href="/notes">Import notes <ArrowRight size={16} /></Link></section>
      : <>
        <div className="stat-grid">
          <div className="stat"><span>Topics assessed</span><strong>{stats.assessed}<small> / {stats.total}</small></strong></div>
          <div className="stat"><span>Demonstrated (level 3+)</span><strong>{stats.demonstrated}</strong></div>
          <div className="stat"><span>Personal notes</span><strong>{noteCount ?? 0}</strong></div>
        </div>
        <div className="dashboard-grid">
          <section className="panel next-panel"><div className="panel-kicker"><BookOpen size={17} /> UP NEXT</div>
            {next ? <><h2>{next.title}</h2><p>{next.summary}</p>
              <div className="lesson-meta">{tracks.find((t) => t.id === next.track)?.title} · {next.prerequisites.length} prerequisite{next.prerequisites.length === 1 ? "" : "s"}</div>
              <Link className="button button-dark" href={`/curriculum/${next.id}`}>Start studying <ArrowRight size={16} /></Link></>
              : <><h2>Roadmap reviewed</h2><p>Choose a new challenge or import more material.</p>
                <Link href="/curriculum" className="button button-dark">Open roadmap</Link></>}
          </section>
          <section className="panel"><div className="panel-head"><h2>Your roadmap</h2><Link href="/curriculum" className="subtle-link">See all <ArrowRight size={15} /></Link></div>
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
        <section className="panel lower-panel"><div className="panel-head"><h2>Keep learning</h2><Link href="/assessments" className="subtle-link">Assessments <ArrowRight size={15} /></Link></div>
          <div className="quick-grid"><div><NotebookPen size={24} /><h3>Your source material</h3><p>Change or add notes whenever your projects and interests change.</p></div>
            <div><RotateCcw size={24} /><h3>Review due</h3><p>{review.length ? review.map(({ lesson }) => lesson.title).join(", ") : "No reviews due."}</p></div>
          </div>
        </section>
      </>}
  </>;
}
