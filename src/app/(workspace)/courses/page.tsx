import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import { requireAccount } from "@/lib/auth";
import { loadCourse, loadCourseSteps, UnreadableCourseError } from "@/lib/course-queries";
import { InboxImporter } from "@/components/InboxImporter";
import { CourseLessonCard } from "@/components/CourseLessonCard";
import { modulePlanningCard, moduleReviewPrompt } from "@/lib/module-request";
import { nextCourseLesson } from "@/lib/course";
import { CourseReviewCard } from "@/components/CourseReviewCard";
import { CourseModules } from "@/components/CourseModules";
import { BatchModulePlanner } from "@/components/BatchModulePlanner";
import { RememberCourse } from "@/components/RememberCourse";
import { coursePositionToResume, courseStudyHref } from "@/lib/course-position";
import { CourseChatLink } from "@/components/CourseChatLink";
import { ManageCourse } from "@/components/ManageCourse";

export default async function CoursesPage({ searchParams }: { searchParams: Promise<{ id?: string; module?: string; step?: string; page?: string }> }) {
  const { supabase, user } = await requireAccount();
  const [requested, jar] = await Promise.all([searchParams, cookies()]);
  if (requested.id && requested.module && requested.step) {
    redirect(courseStudyHref(requested.id, requested.module, requested.step));
  }

  const query = { id: requested.id ?? jar.get(`study-course-${user.id}`)?.value, module: requested.module };
  const requestedPage = Number(requested.page ?? 1);
  const page = Number.isInteger(requestedPage) && requestedPage > 0 && requestedPage <= 10_000 ? requestedPage : 1;
  const offset = (page - 1) * 20;
  const recentCourses = supabase.from("courses").select("id,display_name,title:raw_block->>title")
    .order("created_at", { ascending: false }).order("id").range(offset, offset + 20);
  const requestedCourse = query.id ? loadCourse(supabase, query.id).catch(error => {
    if (!(error instanceof UnreadableCourseError)) throw error;
    return error;
  }) : null;
  const [{ data: recent, error }, initial] = await Promise.all([recentCourses, requestedCourse]);
  if (error) throw new Error("Could not load courses.");
  let result: Awaited<ReturnType<typeof loadCourse>> = null;
  let courseError = "";
  try {
    if (initial instanceof UnreadableCourseError) throw initial;
    result = initial;
    if (!result && !requested.id && recent.length && query.id !== recent[0].id) {
      query.id = recent[0].id;
      result = await loadCourse(supabase, recent[0].id);
    }
  } catch (error) {
    if (!(error instanceof UnreadableCourseError)) throw error;
    courseError = error.message;
  }
  if (requested.id && !result && !courseError) notFound();
  const allSteps = query.id && result ? await loadCourseSteps(supabase, query.id) : [];
  const savedPosition = jar.get(`study-position-${user.id}`)?.value;
  const selected = result?.course.modules.find(item => item.id === query.module);
  const steps = allSteps.filter(step => step.module_key === selected?.id).sort((a, b) => a.position - b.position);
  const next = result ? nextCourseLesson(result.course, allSteps) : null;
  const resume = result && query.id ? coursePositionToResume(savedPosition, query.id, result.course, allSteps) : null;
  const completed = allSteps.filter(step => step.completed_at).length;
  const plannedIds = [...new Set(allSteps.map(step => step.module_key))];
  const unplanned = result ? result.course.modules.length - plannedIds.length : 0;
  const { not_covered: exclusions = [], open_questions: questions = [] } = result?.course ?? {};

  return <div className="course-workspace">
    {result && query.id && <RememberCourse userId={user.id} courseId={query.id} moduleIndex={selected && !steps.length ? result.course.modules.indexOf(selected) : undefined} />}
    <div className="page-heading"><h1>Courses</h1></div>
    {courseError && <p role="alert">{courseError}</p>}
    {courseError && query.id && <section className="panel">
      <ManageCourse key={query.id} courseId={query.id} name={recent.find(row => row.id === query.id)?.display_name ?? ""} />
    </section>}
    {result && query.id && <section className="panel next-panel">
      <h2 className="course-name">{result.name}</h2>
      {resume && <p>Continue at {resume.step ? `${resume.step.id} · ${resume.module.title}` : resume.module.title}</p>}
      <div className="import-actions">
        {resume && <Link className="button button-dark" href={resume.step
          ? courseStudyHref(query.id, resume.module.id, resume.step.row_id)
          : { pathname: "/courses", query: { id: query.id, module: resume.module.id }, hash: "module-plan" }}>
          {resume.step ? "Continue studying" : "Prepare the next lesson plan"}
        </Link>}
        <a className="button button-light" href={result.chatUrl ?? "https://chatgpt.com/"} target="_blank" rel="noopener noreferrer">
          {result.chatUrl ? "Open course in ChatGPT" : "Open ChatGPT"}
        </a>
        <Link className="button button-light" href="#saved-courses">Switch course</Link>
      </div>
      <div className="course-options"><CourseChatLink key={query.id} courseId={query.id} url={result.chatUrl} /></div>
      <ManageCourse key={`manage-${query.id}`} courseId={query.id} name={result.name} />
    </section>}
    {result && query.id && <section className="panel course-path" id="course-path"><h2>Course roadmap</h2><p>{result.course.goal}</p>
      <p>Target: {result.course.target}</p><p>Starting level: {result.course.assumed_level}</p>
      <p><Link href={`/library/exports/${result.course.export_id}`}>Saved Library snapshot</Link></p>
      <div className="course-progress-heading"><p><strong>{!allSteps.length ? "Prepare a lesson plan to start" : !next ? "All lessons finished" : "Lesson progress"}</strong></p><p>{result.course.modules.length} modules · {completed} of {allSteps.length} planned lessons done</p>
        <progress className="course-progress" aria-label="Planned lessons completed" value={completed} max={allSteps.length || 1} />
        {unplanned > 0 && <p>{unplanned} {unplanned === 1 ? "module needs" : "modules need"} a lesson plan.</p>}
      </div>
      {unplanned > 1 && <BatchModulePlanner key={`${query.id}:${unplanned}`} courseId={query.id} course={result.course} plannedIds={plannedIds} />}
      <CourseModules key={query.id} courseId={query.id} course={result.course} steps={allSteps} selectedModule={selected?.id ?? resume?.module.id} nextModule={next?.module.id} nextStep={next?.step?.row_id} />
      {!!(exclusions.length || questions.length || result.unassigned.length) && <details className="course-disclosure">
        <summary>Course coverage and open questions</summary>
        <p>See what ChatGPT left out or flagged for clarification. Read this if you want to check what the roadmap covers.</p>
        {!!exclusions.length && <><h3>Left out of the course</h3>
          <ul>{exclusions.map(item => <li key={item.id}><strong>{item.id}</strong> · {item.why}</li>)}</ul></>}
        {!!questions.length && <><h3>Questions to clarify with ChatGPT</h3>
          <ul>{questions.map((question, index) => <li key={index}>{question}</li>)}</ul></>}
        {!!result.unassigned.length && <><h3>Library items not accounted for</h3>
          <p>{result.unassigned.join(", ")}</p></>}
      </details>}
    </section>}
    {query.module && !selected && <p role="status">Module not found in this course.</p>}
    {result && query.id && selected && <section className="panel" id="module-plan">
      <h2>{steps.length ? "Review lesson plan" : "Prepare lesson plan"} · {selected.id}</h2>
      {steps.length ? <>
        <p className="muted">Ask ChatGPT to check this module for missing prerequisites, jumps in difficulty, or exercises that need a worked example. Use its feedback in the same chat.</p>
        <details className="course-disclosure"><summary>Get the plan review request</summary>
          <CourseLessonCard key={selected.id} label="Copy plan review request" text={moduleReviewPrompt(result.course, selected, steps)} />
        </details>
      </> : <>
        <p><strong>{selected.title}</strong> is in your roadmap and needs its lesson steps. Copy the request into your course chat, then import the file it returns.</p>
        <CourseLessonCard key={`${query.id}/${selected.id}`} label="Copy lesson plan request" text={modulePlanningCard(query.id, result.course, [selected])} />
        <div className="lesson-section"><h3>Import this module&apos;s plan</h3>
          <InboxImporter key={`${query.id}/${selected.id}`} moduleScope={{ courseId: query.id, moduleId: selected.id }} />
        </div>
        {unplanned > 1 && <p><Link className="text-link" href="#batch-plans">Plan several modules at once</Link></p>}
      </>}
    </section>}
    <section className="panel" id="saved-courses"><h2>Saved courses</h2>
      {recent.length ? <ul>{recent.slice(0, 20).map(row => <li key={row.id}>
        <Link className="course-name" href={`/courses?id=${row.id}`} aria-current={row.id === query.id ? "true" : undefined}>{row.display_name ?? (row.title || "Untitled course")}</Link>
        {row.id === query.id && " · Current"}
      </li>)}</ul>
        : <p>{page === 1 ? "No courses saved yet." : "No more courses."}</p>}
      <div className="import-actions">
        {page > 1 && <Link href={{ pathname: "/courses", query: { id: query.id, page: page - 1 }, hash: "saved-courses" }}>Newer courses</Link>}
        {recent.length > 20 && <Link href={{ pathname: "/courses", query: { id: query.id, page: page + 1 }, hash: "saved-courses" }}>Older courses</Link>}
      </div>
    </section>
    {result && <CourseReviewCard key={query.id} course={result.course} />}
    <div className="import-actions">
      <Link className="button button-accent" href="/inbox">Import a course from ChatGPT</Link>
      {!result && <Link className="button button-light" href="/library">Prepare a Library snapshot</Link>}
      <Link className="text-link" href="/portfolio">Plan repository courses</Link>
    </div>
  </div>;
}
