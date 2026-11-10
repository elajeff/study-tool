import Link from "next/link";
import { Check, ArrowUpRight } from "lucide-react";
import { loadStudy } from "@/lib/study";
import { topicPath } from "@/lib/curriculum";
import { latestApproved, demonstratedLessons, type Assessment } from "@/lib/progress";

export default async function CurriculumPage() {
  const { supabase, profile, lessons, tracks } = await loadStudy();
  const { data, error } = await supabase.from("assessment_receipts").select("*").eq("status", "approved").limit(1000);
  if (error) throw new Error("Could not load assessments. Apply the database migration first.");
  const latest = latestApproved((data ?? []) as Assessment[]);
  const demonstrated = demonstratedLessons(lessons, latest);
  return <><div className="page-heading"><span className="eyebrow">YOUR ROADMAP</span><h1>Built from your notes.</h1>
    <p>{profile ? `${profile.goals} · ${profile.hours_per_week} hours per week` : "Add your goals to build your roadmap."}</p></div>
    {!profile ? <section className="panel"><h2>Start with your goals</h2><Link href="/settings" className="button button-dark">Set goals</Link></section>
      : !lessons.length ? <section className="panel"><h2>Import some material first</h2><p>Bring in an Obsidian vault ZIP or your own Markdown notes.</p><Link href="/notes" className="button button-dark">Open notes</Link></section>
      : <div className="curriculum-sections">{tracks.map((track, index) => {
        const own = lessons.filter((lesson) => lesson.track === track.id);
        const count = own.filter((lesson) => demonstrated.has(lesson.id)).length;
        return <section className="panel track-section" id={track.id} key={track.id}>
          <div className="track-header"><span className="track-number">{String(index + 1).padStart(2, "0")}</span>
            <div><h2>{track.title}</h2><p>{track.description}</p></div><span className="count-pill">{count}/{own.length}</span></div>
          <div className="lesson-rows">{own.map((lesson, i) => {
            const score = latest.get(topicPath(lesson.sourcePath));
            const isDone = demonstrated.has(lesson.id);
            const ready = lesson.prerequisites.every((id) => demonstrated.has(id));
            return <Link href={`/curriculum/${lesson.id}`} key={lesson.id} className="lesson-row">
              <span className={`lesson-index ${isDone ? "done" : ""}`}>{isDone ? <Check size={15} /> : String(i + 1).padStart(2, "0")}</span>
              <div><strong>{lesson.title}</strong><small>{lesson.summary}</small></div>
              <span className="lesson-state">{score ? `Level ${score.level}` : ready ? "Not assessed" : "Later"}</span><ArrowUpRight size={17} />
            </Link>;
          })}</div>
        </section>;
      })}</div>}
  </>;
}
