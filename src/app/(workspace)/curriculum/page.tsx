import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { requireAccount } from "@/lib/auth";
import { loadNoteTopics } from "@/lib/study";

export default async function CurriculumPage() {
  const { supabase } = await requireAccount();
  const { lessons, tracks, issues } = await loadNoteTopics(supabase);
  return <><div className="page-heading"><h1>Note topics</h1><p>Topics organized from your saved notes. Your ChatGPT course roadmap is in <Link className="text-link" href="/courses">Courses</Link>.</p></div>
    {issues.length > 0 && <section className="panel" role="alert"><h2>Check your source notes</h2>
      {issues.map((issue) => <p key={issue}>{issue}</p>)}<Link href="/notes" className="text-link">Open notes</Link></section>}
    {!lessons.length && !issues.length ? <section className="panel"><h2>No study topics</h2><p>Import an Obsidian vault ZIP or Markdown files.</p><Link href="/notes" className="button button-dark">Open notes</Link></section>
      : <div className="curriculum-sections">{tracks.map((track, index) => {
        const own = lessons.filter((lesson) => lesson.track === track.id);
        return <section className="panel track-section" id={track.id} key={track.id}>
          <div className="track-header"><span className="track-number">{String(index + 1).padStart(2, "0")}</span>
            <div><h2>{track.title}</h2><p>{track.description}</p></div><span className="count-pill">{own.length}</span></div>
          <div className="lesson-rows">{own.map((lesson, i) =>
            <Link href={`/curriculum/${lesson.id}`} key={lesson.id} className="lesson-row">
              <span className="lesson-index">{String(i + 1).padStart(2, "0")}</span>
              <div><strong>{lesson.title}</strong><small>{lesson.sourceName} · {lesson.summary}</small></div>
              <span className="lesson-state">{lesson.prerequisiteWarning && "Check links"}</span><ArrowUpRight size={17} />
            </Link>
          )}</div>
        </section>;
      })}</div>}
  </>;
}
