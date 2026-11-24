import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { CourseLessonCard } from "@/components/CourseLessonCard";
import { CourseStepAction } from "@/components/CourseStepAction";
import { RememberCourse } from "@/components/RememberCourse";
import { requireAccount } from "@/lib/auth";
import { nextCourseLesson } from "@/lib/course";
import { courseStudyHref } from "@/lib/course-position";
import { loadCourse, loadCourseSteps, UnreadableCourseError } from "@/lib/course-queries";
import { lessonStudyCard } from "@/lib/lesson-request";

export default async function StudyLessonPage({ searchParams }: { searchParams: Promise<{ id?: string; module?: string; step?: string }> }) {
  const { id, module: moduleId, step: stepId } = await searchParams;
  if (!id || !moduleId) redirect("/courses");

  const { supabase, user } = await requireAccount();
  const course = await loadCourse(supabase, id).catch(error => {
    if (!(error instanceof UnreadableCourseError)) throw error;
    redirect(`/courses?id=${id}`);
  });
  const selected = course?.course.modules.find(module => module.id === moduleId);
  if (!course || !selected) notFound();

  const steps = await loadCourseSteps(supabase, id);
  const moduleSteps = steps.filter(step => step.module_key === moduleId).sort((a, b) => a.position - b.position);
  const step = stepId ? moduleSteps.find(step => step.row_id === stepId) : moduleSteps.find(step => !step.completed_at) ?? moduleSteps[0];
  const roadmap = { pathname: "/courses", query: { id, module: moduleId } };
  if (!step) {
    if (stepId) notFound();
    redirect(`/courses?${new URLSearchParams(roadmap.query)}#module-plan`);
  }

  const next = step.completed_at ? nextCourseLesson(course.course, steps) : null;
  return <div className="course-study">
    <RememberCourse userId={user.id} courseId={id} moduleIndex={course.course.modules.indexOf(selected)} stepId={step.row_id} />
    <Link className="back-link" href={roadmap}><ArrowLeft size={16} /> Back to roadmap</Link>
    <div className="page-heading">
      <p className="course-name">{course.name} · {selected.title}</p>
      <h1 className="course-name">{step.goal}</h1>
      <p>{step.id} · Lesson {step.position} of {moduleSteps.length}</p>
    </div>
    <section className="panel">
      <h2>Study with ChatGPT</h2>
      <p>In the chat that created your course, say <strong>start</strong> for the first lesson or ask to continue at <strong>{step.id}</strong>.</p>
      <a className="button button-accent" href={course.chatUrl ?? "https://chatgpt.com/"} target="_blank" rel="noopener noreferrer">
        {course.chatUrl ? "Open course in ChatGPT" : "Open ChatGPT"}
      </a>
      <details className="course-disclosure"><summary>Get a saved lesson request</summary>
        <p className="muted small">Use this if you switch chats, ChatGPT loses your place, or it skips independent practice.</p>
        <CourseLessonCard key={step.row_id} label="Copy lesson request" text={lessonStudyCard(id, course.course, selected, step)} />
      </details>
      <div className="lesson-section">
        <h2>After studying</h2>
        <div className="lesson-outcome">
          <h3>What you should be able to do</h3>
          <p>{step.done_when}</p>
        </div>
        <p>Try the exercise yourself and get feedback in ChatGPT before marking this lesson done.</p>
        <p className="muted small">Lesson sources · {step.sources.join(", ")}</p>
        <div className="import-actions lesson-completion">
          <span className="lesson-state" role="status">{step.completed_at ? "Done" : "Not started"}</span>
          <CourseStepAction key={step.row_id} courseId={id} step={step} />
          {next && <Link className="button button-accent" href={next.step
            ? courseStudyHref(id, next.module.id, next.step.row_id)
            : { pathname: "/courses", query: { id, module: next.module.id }, hash: "module-plan" }}>
            {next.step ? "Go to next lesson" : "Prepare the next lesson plan"}
          </Link>}
        </div>
      </div>
    </section>
  </div>;
}
