import { nextCourseLesson, type Course, type CourseProgressStep } from "./course.ts";

export function savedCoursePosition<T extends CourseProgressStep>(raw: string | undefined, courseId: string, course: Course, steps: T[]) {
  const position = raw?.split("~").find(entry => entry.startsWith(`${courseId}.`));
  const [, index, stepId] = (position ?? "").split(".");
  if (!/^\d+$/.test(index ?? "")) return null;
  const courseModule = course.modules[Number(index)];
  if (!courseModule) return null;
  return { module: courseModule, step: steps.find(step => step.row_id === stepId && step.module_key === courseModule.id) };
}

export function coursePositionToResume<T extends CourseProgressStep>(raw: string | undefined, courseId: string, course: Course, steps: T[]) {
  const next = nextCourseLesson(course, steps);
  if (!next) return null;
  const saved = savedCoursePosition(raw, courseId, course, steps);
  if (!saved) return next;
  if (saved.step && !saved.step.completed_at) return saved;
  if (!saved.step && !steps.some(step => step.module_key === saved.module.id)) return saved;
  return next;
}

export function updateCoursePositions(raw: string | undefined, courseId: string, position?: string) {
  const positions = (raw ?? "").split("~").filter(entry => entry && !entry.startsWith(`${courseId}.`));
  if (position !== undefined) positions.unshift(`${courseId}.${position}`);
  // Keep the cookie below the browser size limit, even with UUIDs in each entry.
  return positions.slice(0, 20).join("~");
}

export function courseStudyHref(courseId: string, moduleId: string, stepId?: string) {
  const query = new URLSearchParams({ id: courseId, module: moduleId });
  if (stepId) query.set("step", stepId);
  return `/courses/study?${query}`;
}
