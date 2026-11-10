import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BookOpen, CheckCircle2, Lightbulb } from "lucide-react";
import { loadStudy } from "@/lib/study";
import { getLesson } from "@/lib/curriculum";
import { LessonControls } from "@/components/LessonControls";
import { TutorHandoff } from "@/components/TutorHandoff";

export default async function LessonPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { supabase, profile, lessons, tracks } = await loadStudy();
  const lesson = getLesson(lessons, slug);
  if (!lesson) notFound();
  const { data: progress } = await supabase.from("lesson_progress")
    .select("lesson_id,status,mastery,reflection,updated_at").eq("lesson_id", lesson.id).maybeSingle();
  const track = tracks.find((t) => t.id === lesson.track);
  return <div className="lesson-page"><Link href="/curriculum" className="back-link"><ArrowLeft size={16} /> Back to roadmap</Link>
    <div className="page-heading"><span className="eyebrow">{track?.title}</span><h1>{lesson.title}</h1><p>{lesson.summary}</p><small>Source: {lesson.sourcePath}</small></div>
    <div className="lesson-layout"><article className="lesson-body">
      <section className="panel lesson-section"><div className="panel-kicker"><BookOpen size={17} /> YOUR SOURCE NOTE</div><h2>What it says</h2><p>{lesson.explanation}</p>{lesson.example && <div className="code-sample"><div className="code-label">Example from your notes</div><pre><code>{lesson.example}</code></pre></div>}<p className="muted small">This outline comes from your imported material. Your tutor can turn it into a full lesson; Study Tool does not invent detailed explanations in the background.</p></section>
      <section className="panel lesson-section"><div className="panel-kicker"><Lightbulb size={17} /> TRY IT YOURSELF</div><h2>Practice</h2><p>{lesson.exercise}</p><div className="completion-note"><CheckCircle2 size={20} /><div><strong>When to mark complete</strong><p>{lesson.completion}</p></div></div></section>
      <TutorHandoff lesson={lesson} profile={profile!} prerequisiteNames={lesson.prerequisites.map((id) => getLesson(lessons, id)?.title ?? id)} />
    </article><aside className="lesson-aside"><LessonControls key={lesson.id} lesson={lesson} progress={progress ?? undefined} /><section className="panel prerequisites"><h3>Required foundations (from notes)</h3>{lesson.prerequisites.length ? <ul>{lesson.prerequisites.map((id) => { const related = getLesson(lessons, id); return <li key={id}><Link href={`/curriculum/${id}`}>{related?.title ?? id}</Link></li>; })}</ul> : <p>No prerequisites recorded.</p>}{lesson.recommendations.length > 0 && <><h3>Useful background</h3><ul>{lesson.recommendations.map((id) => { const related = getLesson(lessons, id); return <li key={id}><Link href={`/curriculum/${id}`}>{related?.title ?? id}</Link></li>; })}</ul></>}</section></aside></div>
  </div>;
}
