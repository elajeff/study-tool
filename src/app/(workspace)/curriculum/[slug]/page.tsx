import Link from "next/link";
import { notFound } from "next/navigation";
import { NoteMarkdown } from "@/components/NoteMarkdown";
import { ArrowLeft, BookOpen } from "lucide-react";
import { loadStudy } from "@/lib/study";
import { getLesson } from "@/lib/curriculum";
import { TutorHandoff } from "@/components/TutorHandoff";

export default async function LessonPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { profile, lessons, tracks } = await loadStudy();
  const lesson = getLesson(lessons, slug);
  if (!lesson) notFound();
  const track = tracks.find((item) => item.id === lesson.track);

  return <div className="lesson-page">
    <Link href="/curriculum" className="back-link"><ArrowLeft size={16} /> Back to note topics</Link>
    <div className="page-heading"><span className="eyebrow">{track?.title}</span>
      <h1>{lesson.title}</h1><p>{lesson.summary}</p><small>Source: {lesson.sourceName} · {lesson.sourcePath}</small>
      {lesson.prerequisiteWarning && <p role="alert">{lesson.prerequisiteWarning}</p>}
    </div>
    <div className="lesson-layout">
      <article className="lesson-body">
        <section className="panel lesson-section">
          <div className="panel-kicker"><BookOpen size={17} /> Source note</div>
          <div className="markdown-body"><NoteMarkdown body={lesson.sourceBody} /></div>
        </section>
        <TutorHandoff lesson={lesson} profile={profile!}
          prerequisiteNames={lesson.prerequisites.map((id) => getLesson(lessons, id)?.title ?? id)} />
      </article>
      <aside className="lesson-aside">
        <section className="panel prerequisites"><h3>Prerequisites</h3>
          {lesson.prerequisites.length ? <ul>{lesson.prerequisites.map((id) => {
            const related = getLesson(lessons, id);
            return <li key={id}><Link href={`/curriculum/${id}`}>{related?.title ?? id}</Link></li>;
          })}</ul> : <p>No linked prerequisites recorded.</p>}
          {lesson.recommendations.length > 0 && <><h3>Useful background</h3><ul>
            {lesson.recommendations.map((id) => {
              const related = getLesson(lessons, id);
              return <li key={id}><Link href={`/curriculum/${id}`}>{related?.title ?? id}</Link></li>;
            })}
          </ul></>}
        </section>
      </aside>
    </div>
  </div>;
}
