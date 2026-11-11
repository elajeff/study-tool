import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { ArrowLeft, BookOpen, Lightbulb } from "lucide-react";
import { loadStudy } from "@/lib/study";
import { getLesson, topicPath } from "@/lib/curriculum";
import { latestApproved } from "@/lib/progress";
import { LessonControls } from "@/components/LessonControls";
import { TutorHandoff } from "@/components/TutorHandoff";

import { loadAssessments } from "@/lib/assessment-queries";

export default async function LessonPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { supabase, profile, lessons, tracks } = await loadStudy();
  const lesson = getLesson(lessons, slug);
  if (!lesson) notFound();
  const assessment = latestApproved(await loadAssessments(supabase, "approved", topicPath(lesson.sourcePath))).get(topicPath(lesson.sourcePath));
  const track = tracks.find((item) => item.id === lesson.track);

  return <div className="lesson-page">
    <Link href="/curriculum" className="back-link"><ArrowLeft size={16} /> Back to roadmap</Link>
    <div className="page-heading"><span className="eyebrow">{track?.title}</span>
      <h1>{lesson.title}</h1><p>{lesson.summary}</p><small>Source: {lesson.sourcePath}</small>
    </div>
    <div className="lesson-layout">
      <article className="lesson-body">
        <section className="panel lesson-section">
          <div className="panel-kicker"><BookOpen size={17} /> SOURCE NOTE</div>
          <div className="markdown-body"><ReactMarkdown>{lesson.sourceBody}</ReactMarkdown></div>
        </section>
        <section className="panel lesson-section">
          <div className="panel-kicker"><Lightbulb size={17} /> PRACTICE</div>
          <p>{lesson.completion}</p>
          <p className="muted small">The note is reference material. Demonstrate the skill with a new exercise before approving an assessment.</p>
        </section>
        <TutorHandoff lesson={lesson} profile={profile!}
          prerequisiteNames={lesson.prerequisites.map((id) => getLesson(lessons, id)?.title ?? id)} />
      </article>
      <aside className="lesson-aside">
        <LessonControls lesson={lesson} assessment={assessment} />
        <section className="panel prerequisites"><h3>Required foundations</h3>
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
