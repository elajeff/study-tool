import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAccount } from "@/lib/auth";
import { loadCourse, loadCourseSteps } from "@/lib/course-queries";
import { CourseImporter } from "@/components/CourseImporter";
import { ModuleImporter } from "@/components/ModuleImporter";
import { CourseLessonCard } from "@/components/CourseLessonCard";
import { modulePlanningCard } from "@/lib/module-request";
import { lessonStudyCard } from "@/lib/lesson-request";
import { markCourseStep } from "@/app/course-actions";

export default async function CoursesPage({ searchParams }: { searchParams: Promise<{ id?: string; module?: string; step?: string }> }) {
  const { supabase } = await requireAccount();
  const query = await searchParams;
  const { data: recent, error } = await supabase.from("courses").select("id,title:raw_block->>title")
    .order("created_at", { ascending: false }).limit(20);
  if (error) throw new Error("Could not load courses. Check migration 011.");
  const result = query.id ? await loadCourse(supabase, query.id) : null;
  if (query.id && !result) notFound();
  const selected = result?.course.modules.find(item => item.id === query.module);
  const steps = query.id && selected ? (await loadCourseSteps(supabase, query.id)).filter(step => step.module_key === selected.id).sort((a, b) => a.position - b.position) : [];
  const currentStep = query.step ? steps.find(step => step.row_id === query.step) : steps[0];
  return <>
    <div className="page-heading"><h1>Courses</h1><p>Saved outlines reference the exported source versions. Importing an outline does not demonstrate mastery.</p></div>
    <section className="panel"><details open={!query.id}><summary>Import from ChatGPT</summary>
      <p>Paste one complete course JSON object or study-course code block. The Library version is detected automatically.</p><CourseImporter />
      <p><Link href="/library">Prepare a Library snapshot</Link></p>
    </details></section>
    <section className="panel"><h2>Recent courses</h2>
      {recent.length ? <ul>{recent.map(row => <li key={row.id}><Link href={`/courses?id=${row.id}`}>{row.title}</Link></li>)}</ul> : <p>No courses saved yet.</p>}
    </section>
    {result && <section className="panel"><h2>{result.course.title}</h2><p>{result.course.goal}</p>
      <p>Target: {result.course.target}</p><p>Starting level: {result.course.assumed_level}</p>
      <p><Link href={`/library/exports/${result.course.export_id}`}>Saved Library snapshot</Link></p>
      <p>Source items without a module or exclusion: {result.unassigned.length}. This is file accounting, not a check of teaching completeness.</p>
      <ol>{result.course.modules.map(module => <li key={module.id}><h3>{module.id} · {module.title}</h3><p>{module.outcome}</p>
        <p>Prerequisites: {module.needs.join(", ") || "None"}. Estimated steps: {module.steps_estimate}.</p>
        <p>Sources: {module.sources.join(", ")}.</p><p>Independent proof: {module.proof}</p>
        <Link href={{ pathname: "/courses", query: { id: query.id, module: module.id }, hash: "module-plan" }}>Open lesson plan</Link>
      </li>)}</ol>
      <details><summary>Exclusions and open questions</summary>
        <ul>{result.course.not_covered.map(item => <li key={item.id}>{item.id}: {item.why}</li>)}</ul>
        <ul>{result.course.open_questions.map((question, index) => <li key={index}>{question}</li>)}</ul>
        {!!result.unassigned.length && <p>Unassigned items: {result.unassigned.join(", ")}</p>}
      </details>
    </section>}
    {query.module && !selected && <p role="status">Module not found in this course.</p>}
    {result && query.id && selected && <section className="panel" id="module-plan"><h2>{selected.id} · Lesson plan</h2>
      {steps.length ? <>
        <ol>{steps.map(step => <li key={step.row_id}>
          <Link href={{ pathname: "/courses", query: { id: query.id, module: selected.id, step: step.row_id }, hash: "lesson-focus" }} aria-current={step.row_id === currentStep?.row_id ? "step" : undefined}>{step.id} · {step.kind}</Link>
          <p>{step.goal}</p><p>Done when: {step.done_when}</p><p>Sources: {step.sources.join(", ")}. Status: {step.completed_at ? "Done" : "Not started"}.</p>
        </li>)}</ol>
        <p>The saved plan keeps its lesson identities. Reimporting the same plan is safe; replacing it with different steps is rejected.</p>
      </> : <><p>Request a plan from ChatGPT, then import its JSON here. Preparing or importing a plan does not demonstrate mastery.</p>
        <CourseLessonCard key={`${query.id}/${selected.id}`} text={modulePlanningCard(query.id, result.course, selected)} />
      </>}
      <details open={!steps.length}><summary>Import a plan</summary><ModuleImporter key={`${query.id}/${selected.id}`} courseId={query.id} moduleId={selected.id} /></details>
    </section>}
    {result && query.id && selected && query.step && !currentStep && <p role="status">Lesson not found in this module.</p>}
    {result && query.id && selected && currentStep && <section className="panel" id="lesson-focus"><h2>{currentStep.id} · Study request</h2>
      <p>{currentStep.goal}</p><p>Done when: {currentStep.done_when}</p>
      <p>Status: {currentStep.completed_at ? "Done" : "Not started"}. Marking a lesson done records study activity, not mastery.</p>
      <form action={markCourseStep}>
        <input type="hidden" name="course_id" value={query.id} />
        <input type="hidden" name="step_id" value={currentStep.row_id} />
        <input type="hidden" name="state" value={currentStep.completed_at ? "reopen" : "studied"} />
        <button className="button button-light">{currentStep.completed_at ? "Reopen" : "Mark done"} {currentStep.id}</button>
      </form>
      <CourseLessonCard key={currentStep.row_id} text={lessonStudyCard(query.id, result.course, selected, currentStep)} />
    </section>}
  </>;
}
