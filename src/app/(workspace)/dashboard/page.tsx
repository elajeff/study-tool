import Link from "next/link";
import { cookies } from "next/headers";
import { requireAccount } from "@/lib/auth";
import { loadCourse, loadCourseSteps } from "@/lib/course-queries";
import { nextCourseLesson } from "@/lib/course";
import { courseOverview } from "@/lib/course-overview";
import { loadAssessments } from "@/lib/assessment-queries";
import { latestApproved } from "@/lib/progress";
import { ProgressExport } from "@/components/ProgressExport";
import { savedCoursePosition } from "@/lib/course-position";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ minutes?: string }> }) {
  const { supabase, user } = await requireAccount();
  const minutes = Number((await searchParams).minutes ?? 30);
  const minutesPerLesson = Number.isInteger(minutes) && minutes >= 5 && minutes <= 240 ? minutes : 30;
  const [courses, profile] = await Promise.all([
    supabase.from("courses").select("id,title:raw_block->>title").order("created_at", { ascending: false }).limit(20),
    supabase.from("study_profiles").select("hours_per_week").eq("user_id", user.id).maybeSingle(),
  ]);
  if (courses.error || profile.error) throw new Error("Could not load your course dashboard.");
  let courseId = (await cookies()).get(`study-course-${user.id}`)?.value ?? courses.data[0]?.id;
  let saved = courseId ? await loadCourse(supabase, courseId) : null;
  if (!saved && courses.data.length) { courseId = courses.data[0].id; saved = await loadCourse(supabase, courses.data[0].id); }
  if (!saved || !courseId) return <>
    <div className="page-heading"><h1>Dashboard</h1><p>Your courses and study progress.</p></div>
    <section className="panel"><h2>No courses yet</h2><p>Import a course from ChatGPT to see its roadmap, next lesson and progress here.</p>
      <div className="import-actions"><Link className="button button-dark" href="/inbox">Import a course</Link><Link className="button button-light" href="/how-to-use">How to use</Link></div>
    </section>
  </>;
  const steps = await loadCourseSteps(supabase, courseId);
  const hoursPerWeek = profile.data?.hours_per_week ?? null;
  const overview = courseOverview(saved.course, steps, minutesPerLesson, hoursPerWeek);
  const next = savedCoursePosition((await cookies()).get(`study-position-${user.id}`)?.value, courseId, saved.course, steps) ?? nextCourseLesson(saved.course, steps);
  const assessments = latestApproved(await loadAssessments(supabase, "approved"));
  const assessed = steps.filter(step => assessments.has(`course-step:${step.row_id}`)).length;
  const nextQuery = new URLSearchParams({ id: courseId });
  if (next) { nextQuery.set("module", next.module.id); if (next.step) nextQuery.set("step", next.step.row_id); }
  return <>
    <div className="page-heading"><h1>Dashboard</h1><p>Your courses and study progress.</p></div>
    <section className="panel next-panel"><h2>{saved.course.title}</h2><p>{saved.course.goal}</p>
      <progress className="course-progress" aria-label="Course modules completed" value={overview.completedModules} max={saved.course.modules.length} />
      <p>{overview.completedModules} of {saved.course.modules.length} modules finished · {overview.completedLessons} of {overview.plannedLessons} planned lessons done</p>
      <div className="import-actions"><Link className="button button-dark" href={`/courses?${nextQuery}#${next?.step ? "lesson-focus" : next ? "module-plan" : "course-path"}`}>
        {next ? "Continue studying" : "View completed course"}
      </Link><Link className="button button-light" href={`/courses?id=${courseId}`}>Open roadmap</Link></div>
      {next && <p>Next: {next.step?.goal ?? next.module.title}</p>}
    </section>
    <div className="stat-grid course-dashboard-stats">
      <div className="stat"><span>Lessons marked done</span><strong>{overview.completedLessons}</strong></div>
      <div className="stat"><span>Lessons with approved assessments</span><strong>{assessed}</strong></div>
      <div className="stat"><span>Modules needing lesson plans</span><strong>{overview.unplannedModules}</strong></div>
    </div>
    <div className="dashboard-grid">
      <section className="panel"><h2>Estimated time remaining</h2>
        <p><strong>{Math.ceil(overview.remainingHours * 10) / 10} hours</strong>{overview.calendarDays !== null ? ` · about ${overview.calendarDays} calendar days at ${hoursPerWeek} hours/week` : " · Set weekly hours to estimate days."}</p>
        <p>Based on {overview.remainingLessons} remaining lessons at {minutesPerLesson} minutes each. Unplanned modules use the outline&apos;s lesson-count estimates.</p>
        <form method="GET" className="stack"><label htmlFor="lesson-minutes">Estimated minutes per lesson</label>
          <input id="lesson-minutes" className="input" name="minutes" type="number" min={5} max={240} defaultValue={minutesPerLesson} required />
          <button className="button button-light">Update estimate</button>
        </form>
        <p><Link className="text-link" href="/settings">Change weekly study hours</Link></p>
        <p className="muted small">A planning estimate, not measured study time. Days assume your weekly hours are spread evenly. Practice, reviews and difficult lessons can take longer.</p>
      </section>
      <section className="panel"><h2>Recent courses</h2><ul>{courses.data.map(course => <li key={course.id}>
        <Link className="text-link" href={`/courses?id=${course.id}`}>{course.title}</Link>{course.id === courseId ? " · Current" : ""}
      </li>)}</ul><p><Link className="text-link" href="/inbox">Import another course</Link></p>
        <p>Marking lessons done records activity. Approved assessments record demonstrated knowledge separately.</p>
        {!!steps.length && <ProgressExport rows={steps.map(step => {
          const record = assessments.get(`course-step:${step.row_id}`);
          return { title: step.goal, path: `course-step:${step.row_id}`, level: record?.level ?? null, date: record?.date ?? null };
        })} />}
      </section>
    </div>
  </>;
}
