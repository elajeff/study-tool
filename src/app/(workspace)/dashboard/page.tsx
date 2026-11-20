import Link from "next/link";
import { cookies } from "next/headers";
import { requireAccount } from "@/lib/auth";
import { loadCourse, loadCourseSteps, UnreadableCourseError } from "@/lib/course-queries";
import { courseOverview } from "@/lib/course-overview";
import { loadAssessments } from "@/lib/assessment-queries";
import { latestApproved, type Assessment } from "@/lib/progress";
import { ProgressExport } from "@/components/ProgressExport";
import { coursePositionToResume } from "@/lib/course-position";
import { useWeeklyStudyHours } from "@/app/pace-actions";
import { parseStudyPace } from "@/lib/study-pace";
import { StudyPaceForm } from "@/components/StudyPaceForm";

export default async function DashboardPage() {
  const { supabase, user } = await requireAccount();
  const pace = parseStudyPace((await cookies()).get(`study-pace-${user.id}`)?.value);
  const minutesPerLesson = pace?.minutesPerLesson ?? 30;
  const [courses, profile] = await Promise.all([
    supabase.from("courses").select("id,display_name,title:raw_block->>title").order("created_at", { ascending: false }).limit(20),
    supabase.from("study_profiles").select("hours_per_week").eq("user_id", user.id).maybeSingle(),
  ]);
  if (courses.error || profile.error) throw new Error("Could not load your course dashboard.");
  let courseId = (await cookies()).get(`study-course-${user.id}`)?.value ?? courses.data[0]?.id;
  let saved: Awaited<ReturnType<typeof loadCourse>> = null;
  try {
    if (courseId) saved = await loadCourse(supabase, courseId);
    if (!saved && courses.data.length && courseId !== courses.data[0].id) {
      courseId = courses.data[0].id;
      saved = await loadCourse(supabase, courseId);
    }
  } catch (error) {
    if (!(error instanceof UnreadableCourseError)) throw error;
    return <section className="panel"><h1>Dashboard</h1><p role="alert">{error.message}</p>
      <Link className="button button-dark" href="/courses#saved-courses">Open saved courses</Link>
    </section>;
  }
  if (!saved || !courseId) return <>
    <div className="page-heading"><h1>Dashboard</h1><p>Your courses and study progress.</p></div>
    <section className="panel"><h2>No courses yet</h2><p>Import a course from ChatGPT to see its roadmap, next lesson and progress here.</p>
      <div className="import-actions"><Link className="button button-dark" href="/inbox">Import a course</Link><Link className="button button-light" href="/how-to-use">How to use</Link></div>
    </section>
  </>;
  const steps = await loadCourseSteps(supabase, courseId);
  const hoursPerWeek = pace ? pace.hoursPerDay * pace.daysPerWeek : profile.data?.hours_per_week ?? null;
  const overview = courseOverview(saved.course, steps, minutesPerLesson, hoursPerWeek);
  const next = coursePositionToResume((await cookies()).get(`study-position-${user.id}`)?.value, courseId, saved.course, steps);
  const assessments = new Map<string, Assessment>();
  for (let start = 0; start < steps.length; start += 100) {
    const topics = steps.slice(start, start + 100).map(step => `course-step:${step.row_id}`);
    for (const [topic, receipt] of latestApproved(await loadAssessments(supabase, "approved", topics))) {
      assessments.set(topic, receipt);
    }
  }
  const assessed = steps.filter(step => assessments.has(`course-step:${step.row_id}`)).length;
  const nextQuery = new URLSearchParams({ id: courseId });
  if (next) { nextQuery.set("module", next.module.id); if (next.step) nextQuery.set("step", next.step.row_id); }
  return <>
    <div className="page-heading"><h1>Dashboard</h1><p>Your courses and study progress.</p></div>
    <section className="panel next-panel"><h2 className="course-name">{saved.name}</h2><p>{saved.course.goal}</p>
      <progress className="course-progress" aria-label="Course modules completed" value={overview.completedModules} max={saved.course.modules.length} />
      <p>{overview.completedModules} of {saved.course.modules.length} modules finished · {overview.completedLessons} of {overview.plannedLessons} planned lessons done</p>
      <div className="import-actions"><Link className="button button-dark" href={`/courses?${nextQuery}#${next?.step ? "lesson-focus" : next ? "module-plan" : "course-path"}`}>
        {next ? "Continue studying" : "View completed course"}
      </Link><Link className="button button-light" href={`/courses?id=${courseId}`}>Open roadmap</Link>
      <Link className="button button-light" href="/courses#saved-courses">Switch course</Link></div>
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
        {pace && <p>About {Math.ceil(overview.remainingHours / pace.hoursPerDay)} study days at {pace.hoursPerDay} hours per day, {pace.daysPerWeek} days per week.</p>}
        <StudyPaceForm pace={pace ?? { hoursPerDay: (profile.data?.hours_per_week ?? 5) / 5, daysPerWeek: 5, minutesPerLesson }} />
        {pace ? <form action={useWeeklyStudyHours}>
          <button className="button button-light">Use weekly hours from Settings</button>
        </form> : <p><Link className="text-link" href="/settings">Change weekly study hours</Link></p>}
        <p className="muted small">A planning estimate, not measured study time. Days assume your weekly hours are spread evenly. Practice, reviews and difficult lessons can take longer.</p>
      </section>
      <section className="panel"><h2>Recent courses</h2><ul>{courses.data.map(course => <li key={course.id}>
        <Link className="text-link course-name" href={`/courses?id=${course.id}`}>{course.display_name ?? course.title}</Link>{course.id === courseId ? " · Current" : ""}
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
