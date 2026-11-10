import Link from "next/link";
import { Check, ArrowUpRight } from "lucide-react";
import { loadStudy } from "@/lib/study";
import { type Progress } from "@/lib/progress";

export default async function CurriculumPage() {
  const { supabase, profile, lessons, tracks } = await loadStudy();
  const { data } = await supabase.from("lesson_progress").select("lesson_id,status,mastery,reflection,updated_at");
  const completed = new Set(((data ?? []) as Progress[]).filter((x) => x.status === "completed").map((x) => x.lesson_id));
  return <><div className="page-heading"><span className="eyebrow">YOUR ROADMAP</span><h1>Built from your notes.</h1><p>{profile ? `${profile.goals} · ${profile.hours_per_week} hours per week` : "Tell us your goals, then import your existing knowledge."}</p></div>
    {!profile ? <section className="panel"><h2>Start with your goals</h2><p>There is no default curriculum. Your starting point and study material determine your roadmap.</p><Link href="/settings" className="button button-dark">Set goals</Link></section> : !lessons.length ? <section className="panel"><h2>Import some material first</h2><p>Upload an Obsidian Markdown ZIP or create a few notes. We'll use their topics, relationships and prerequisites to draft a sequence.</p><Link href="/notes" className="button button-dark">Open notes</Link></section> : <div className="curriculum-sections">{tracks.map((track, trackIndex) => { const own = lessons.filter((l) => l.track === track.id); const count = own.filter((l) => completed.has(l.id)).length; return <section className="panel track-section" id={track.id} key={track.id}><div className="track-header"><span className="track-number">{String(trackIndex + 1).padStart(2, "0")}</span><div><h2>{track.title}</h2><p>{track.description}</p></div><span className="count-pill">{count}/{own.length}</span></div><div className="lesson-rows">{own.map((lesson, i) => { const isDone = completed.has(lesson.id); const ready = lesson.prerequisites.every((id) => completed.has(id)); return <Link href={`/curriculum/${lesson.id}`} key={lesson.id} className="lesson-row"><span className={`lesson-index ${isDone ? "done" : ""}`}>{isDone ? <Check size={15} /> : String(i + 1).padStart(2, "0")}</span><div><strong>{lesson.title}</strong><small>{lesson.summary}</small></div><span className="lesson-state">{isDone ? "Complete" : ready ? "Ready" : "Later"}</span><ArrowUpRight size={17} /></Link>; })}</div></section>; })}</div>}
  </>;
}
