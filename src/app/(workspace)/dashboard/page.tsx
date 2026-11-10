import Link from "next/link";
import { ArrowRight, BookOpen, CheckCircle2, ChevronRight, NotebookPen, RotateCcw } from "lucide-react";
import { loadStudy } from "@/lib/study";
import { ProgressExport } from "@/components/ProgressExport";
import { nextLesson } from "@/lib/curriculum";
import { progressStats, isDueForReview, type Progress } from "@/lib/progress";

export default async function DashboardPage() {
  const { supabase, user, profile, lessons, tracks } = await loadStudy();
  const [{ data: progressData }, { count: noteCount }] = await Promise.all([
    supabase.from("lesson_progress").select("lesson_id,status,mastery,reflection,updated_at"),
    supabase.from("notes").select("id", { head: true, count: "exact" }),
  ]);
  const progress = (progressData ?? []) as Progress[];
  const done = new Set(progress.filter((p) => p.status === "completed").map((p) => p.lesson_id));
  const stats = progressStats(lessons.map((l) => l.id), progress);
  const next = nextLesson(lessons, done);
  const review = progress.filter(isDueForReview).filter((p) => lessons.some((l) => l.id === p.lesson_id)).slice(0, 3);
  const firstName = user.email?.split("@")[0] ?? "there";
  return <>
    <div className="page-heading"><span className="eyebrow">YOUR LEARNING SPACE</span><h1>Good to see you, {firstName}.</h1><p>Your roadmap comes from your notes and goals—not a course everyone has to follow.</p><div style={{ marginTop: 18 }}><ProgressExport progress={progress} lessons={lessons} /></div></div>
    {!profile ? <section className="panel next-panel"><h2>Tell us what you want to learn.</h2><p>Add your starting knowledge and goals to create a personal study path.</p><Link className="button button-dark" href="/settings">Set learning goals <ArrowRight size={16} /></Link></section> : !lessons.length ? <section className="panel next-panel"><h2>Bring in your knowledge base.</h2><p>Import Markdown notes from Obsidian or create notes here. Study Tool will build a roadmap from those topics and the prerequisites they document.</p><Link className="button button-dark" href="/notes">Import notes <ArrowRight size={16} /></Link></section> : <>
      <div className="stat-grid"><div className="stat"><span>Topics completed</span><strong>{stats.completed}<small> / {stats.total}</small></strong></div><div className="stat"><span>Overall progress</span><strong>{stats.percent}%</strong><div className="progress-track"><div style={{ width: `${stats.percent}%` }} /></div></div><div className="stat"><span>Personal notes</span><strong>{noteCount ?? 0}</strong></div></div>
      <div className="dashboard-grid"><section className="panel next-panel"><div className="panel-kicker"><BookOpen size={17} /> UP NEXT</div>{next ? <><h2>{next.title}</h2><p>{next.summary}</p><div className="lesson-meta">{tracks.find((t) => t.id === next.track)?.title} · {next.prerequisites.length} prerequisite{next.prerequisites.length === 1 ? "" : "s"}</div><Link className="button button-dark" href={`/curriculum/${next.id}`}>Continue learning <ArrowRight size={16} /></Link></> : <><h2>Roadmap complete</h2><p>Keep practicing and add more notes whenever you learn something new.</p><Link href="/curriculum" className="button button-dark">Review roadmap</Link></>}</section>
        <section className="panel"><div className="panel-head"><h2>Your roadmap</h2><Link href="/curriculum" className="subtle-link">See all <ArrowRight size={15} /></Link></div><div className="track-list">{tracks.map((track, i) => { const own = lessons.filter((l) => l.track === track.id); const count = own.filter((l) => done.has(l.id)).length; return <Link href={`/curriculum#${track.id}`} className="track-row" key={track.id}><span className="track-circle">{count === own.length ? <CheckCircle2 size={18} /> : String(i + 1).padStart(2, "0")}</span><span><strong>{track.title}</strong><small>{count} of {own.length} completed</small></span><ChevronRight size={17} /></Link>; })}</div></section></div>
      <section className="panel lower-panel"><div className="panel-head"><h2>Keep your learning connected</h2><Link href="/notes" className="subtle-link">Open notes <ArrowRight size={15} /></Link></div><div className="quick-grid"><div><NotebookPen size={24} /><h3>Your source material</h3><p>Lessons are grounded in the notes you imported. You can update them at any time.</p></div><div><RotateCcw size={24} /><h3>Review what matters</h3>{review.length ? <p>{review.length} topic{review.length === 1 ? "" : "s"} due for review: {review.map((p) => lessons.find((l) => l.id === p.lesson_id)?.title).filter(Boolean).join(", ")}.</p> : <p>Older topics will appear here as your progress grows.</p>}</div></div></section>
    </>}
  </>;
}
