import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { requireAccount } from "@/lib/auth";
import { loadCourse, loadCourseSteps, UnreadableCourseError } from "@/lib/course-queries";
import { InboxImporter } from "@/components/InboxImporter";
import { CourseLessonCard } from "@/components/CourseLessonCard";
import { modulePlanningCard, moduleReviewPrompt } from "@/lib/module-request";
import { lessonStudyCard } from "@/lib/lesson-request";
import { nextCourseLesson } from "@/lib/course";
import { loadAssessments } from "@/lib/assessment-queries";
import { latestApproved } from "@/lib/progress";
import { LessonControls } from "@/components/LessonControls";
import { CourseReviewCard } from "@/components/CourseReviewCard";
import { CourseModules } from "@/components/CourseModules";
import { CourseStepAction } from "@/components/CourseStepAction";
import { BatchModulePlanner } from "@/components/BatchModulePlanner";
import { RememberCourse } from "@/components/RememberCourse";
import { coursePositionToResume, savedCoursePosition } from "@/lib/course-position";
import { CourseChatLink } from "@/components/CourseChatLink";

export default async function CoursesPage({ searchParams }: { searchParams: Promise<{ id?: string; module?: string; step?: string; page?: string }> }) {
  const { supabase, user } = await requireAccount();
  const requested = await searchParams;
  const query = { ...requested };
  const requestedPage = Number(requested.page ?? 1);
  const page = Number.isInteger(requestedPage) && requestedPage > 0 && requestedPage <= 10_000 ? requestedPage : 1;
  const offset = (page - 1) * 20;
  const { data: recent, error } = await supabase.from("courses").select("id,title:raw_block->>title")
    .order("created_at", { ascending: false }).order("id").range(offset, offset + 20);
  if (error) throw new Error("Could not load courses. Check migration 011.");
  if (!query.id) query.id = (await cookies()).get(`study-course-${user.id}`)?.value ?? recent[0]?.id;
  let result: Awaited<ReturnType<typeof loadCourse>> = null;
  let courseError = "";
  try {
    if (query.id) result = await loadCourse(supabase, query.id);
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
  const savedPosition = (await cookies()).get(`study-position-${user.id}`)?.value;
  if (result && query.id && !requested.module && !requested.step) {
    const position = savedCoursePosition(savedPosition, query.id, result.course, allSteps);
    if (position) { query.module = position.module.id; query.step = position.step?.row_id; }
  }
  const selected = result?.course.modules.find(item => item.id === query.module);
  const steps = allSteps.filter(step => step.module_key === selected?.id).sort((a, b) => a.position - b.position);
  const currentStep = query.step ? steps.find(step => step.row_id === query.step) : steps.find(step => !step.completed_at) ?? steps[0];
  const next = result ? nextCourseLesson(result.course, allSteps) : null;
  const resume = result && query.id ? coursePositionToResume(savedPosition, query.id, result.course, allSteps) : null;
  const completed = allSteps.filter(step => step.completed_at).length;
  const plannedIds = [...new Set(allSteps.map(step => step.module_key))];
  const unplanned = result ? result.course.modules.length - plannedIds.length : 0;
  const assessmentTopic = currentStep ? `course-step:${currentStep.row_id}` : undefined;
  const assessment = assessmentTopic ? latestApproved(await loadAssessments(supabase, "approved", assessmentTopic)).get(assessmentTopic) : undefined;
  return <>
    {result && query.id && <RememberCourse userId={user.id} courseId={query.id} moduleIndex={selected ? result.course.modules.indexOf(selected) : undefined} stepId={currentStep?.row_id} />}
    <div className="page-heading"><h1>Courses</h1><p>Saved outlines reference the exported source versions. Importing an outline does not demonstrate mastery.</p></div>
    {courseError && <p role="alert">{courseError}</p>}
    {result && query.id && <section className="panel next-panel">
      <h2>{result.course.title}</h2>
      {resume && <p>Continue at {resume.step?.goal ?? resume.module.title}</p>}
      <div className="import-actions">
        {resume && <Link className="button button-dark" href={{ pathname: "/courses", query: { id: query.id, module: resume.module.id, ...(resume.step ? { step: resume.step.row_id } : {}) }, hash: resume.step ? "lesson-focus" : "module-plan" }}>
          {resume.step ? "Continue studying" : "Prepare the next lesson plan"}
        </Link>}
        <a className="button button-light" href={result.chatUrl ?? "https://chatgpt.com/"} target="_blank" rel="noopener noreferrer">
          {result.chatUrl ? "Open course in ChatGPT" : "Open ChatGPT"}
        </a>
        <Link className="button button-light" href="#saved-courses">Switch course</Link>
      </div>
      <CourseChatLink key={query.id} courseId={query.id} url={result.chatUrl} />
    </section>}
    {result && query.id && <section className="panel course-path" id="course-path"><h2>{result.course.title}</h2><p>{result.course.goal}</p>
      <p>Target: {result.course.target}</p><p>Starting level: {result.course.assumed_level}</p>
      <p><Link href={`/library/exports/${result.course.export_id}`}>Saved Library snapshot</Link></p>
      <p>Source items without a module or exclusion: {result.unassigned.length}. This is file accounting, not a check of teaching completeness.</p>
      <div className="course-progress-heading"><p><strong>{unplanned === result.course.modules.length ? "Outline imported · Prepare a lesson plan to start" : completed === allSteps.length && !unplanned ? "Done · All planned lessons finished" : "Ready to study"}</strong></p><p>{result.course.modules.length} modules · {completed} of {allSteps.length} planned lessons done</p>
        <progress className="course-progress" aria-label="Planned lessons completed" value={completed} max={allSteps.length || 1} />
        <p>{unplanned ? `${unplanned} modules still need a lesson plan.` : "All modules have lesson plans."}</p>
        <p>Done records study activity. Approved assessments track demonstrated knowledge separately.</p>
      </div>
      {!next && <p>All course lessons are marked done. This does not establish mastery.</p>}
      <CourseModules key={query.id} courseId={query.id} course={result.course} steps={allSteps} selectedModule={selected?.id} nextModule={next?.module.id} selectedStep={currentStep?.row_id} nextStep={next?.step?.row_id} />
      <details><summary>Exclusions and open questions</summary>
        <ul>{result.course.not_covered.map(item => <li key={item.id}>{item.id}: {item.why}</li>)}</ul>
        <ul>{result.course.open_questions.map((question, index) => <li key={index}>{question}</li>)}</ul>
        {!!result.unassigned.length && <p>Unassigned items: {result.unassigned.join(", ")}</p>}
      </details>
    </section>}
    {query.module && !selected && <p role="status">Module not found in this course.</p>}
    {result && query.id && selected && <section className="panel" id="module-plan"><h2>{selected.id} · {steps.length ? "Lesson plan ready" : "Prepare lesson plan"}</h2>
      {steps.length ? <p>Choose a lesson in the roadmap to start studying. You do not need to import this plan again.</p>
      : <><p>Request a plan from ChatGPT, then import its JSON here. Preparing or importing a plan does not demonstrate mastery.</p>
        <CourseLessonCard key={`${query.id}/${selected.id}`} text={modulePlanningCard(query.id, result.course, [selected])} />
      </>}
      <details open={!steps.length}><summary>Import a plan</summary>
        <InboxImporter key={`${query.id}/${selected.id}`} openCourse moduleScope={{ courseId: query.id, moduleId: selected.id }} />
      </details>
      {!!steps.length && <details><summary>Review lesson plan with ChatGPT</summary>
        <p>Check for missing prerequisites, jumps in difficulty and exercises that need a better example. The review gives feedback for the tutor to use and leaves the saved plan and progress intact.</p>
        <CourseLessonCard key={selected.id} label="Copy plan review request" text={moduleReviewPrompt(result.course, selected, steps)} />
      </details>}
    </section>}
    {result && query.id && selected && query.step && !currentStep && <p role="status">Lesson not found in this module.</p>}
    {result && query.id && selected && currentStep && <section className="panel" id="lesson-focus"><h2>{currentStep.id} · Study lesson</h2>
      <h3>What you&apos;ll learn</h3><p>{currentStep.goal}</p>
      <h3>Study with ChatGPT</h3><p>Say <strong>start</strong> in the chat that created your course, or ask to continue at {currentStep.id}. Use the saved lesson request when switching chats or asking for an assessment tied to this lesson.</p>
      <details><summary>Get a saved lesson request</summary>
        <CourseLessonCard key={currentStep.row_id} label="Copy lesson request" text={lessonStudyCard(query.id, result.course, selected, currentStep, assessment)} />
      </details>
      <details><summary>Lesson details and sources</summary><p>Done when: {currentStep.done_when}</p><p>Sources: {currentStep.sources.join(", ")}.</p></details>
      <h3>After studying</h3><p>Finish the explanation and exercises in ChatGPT, then mark this lesson done here to continue.</p>
      <p>Status: {currentStep.completed_at ? "Done" : "Not started"}. Marking a lesson done records study activity, not mastery.</p>
      <CourseStepAction courseId={query.id} step={currentStep} />
      <details className="optional-assessment"><summary>{assessment ? "Assessment and review" : "Optional: assess your understanding"}</summary>
        <p>Use this after practicing independently. If ChatGPT returns an assessment receipt, import it through <Link className="text-link" href="/inbox">Inbox</Link>, then review it in <Link className="text-link" href="/assessments">Assessments</Link>. You can continue studying without an assessment.</p>
        <LessonControls assessment={assessment} />
      </details>
    </section>}
    <section className="panel" id="saved-courses"><h2>Saved courses</h2>
      {recent.length ? <ul>{recent.slice(0, 20).map(row => <li key={row.id}>
        <Link href={`/courses?id=${row.id}`} aria-current={row.id === query.id ? "true" : undefined}>{row.title || "Untitled course"}</Link>
        {row.id === query.id && " · Current"}
      </li>)}</ul>
        : <p>{page === 1 ? "No courses saved yet." : "No more courses."}</p>}
      <div className="import-actions">
        {page > 1 && <Link href={{ pathname: "/courses", query: { id: query.id, page: page - 1 }, hash: "saved-courses" }}>Newer courses</Link>}
        {recent.length > 20 && <Link href={{ pathname: "/courses", query: { id: query.id, page: page + 1 }, hash: "saved-courses" }}>Older courses</Link>}
      </div>
    </section>
    {result && query.id && <BatchModulePlanner key={query.id} courseId={query.id} course={result.course} plannedIds={plannedIds} />}
    {result && <CourseReviewCard key={query.id} course={result.course} />}
    <section className="panel"><details open={!result}><summary>Import from ChatGPT</summary>
      <p>Choose the file with your course and first lesson plan, or paste the ChatGPT response.</p><InboxImporter openCourse />
      <p><Link href="/library">Prepare a Library snapshot</Link> · <Link href="/portfolio">Plan repository courses</Link></p>
    </details></section>
  </>;
}
