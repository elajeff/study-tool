import { nextCourseLesson, type Course, type SavedCourseStep } from "./course.ts";

export function savedCoursePosition(raw: string | undefined, courseId: string, course: Course, steps: SavedCourseStep[]) {
  const [savedId, index, stepId] = (raw ?? "").split(".");
  if (savedId !== courseId || !/^\d+$/.test(index ?? "")) return null;
  const courseModule = course.modules[Number(index)];
  if (!courseModule) return null;
  return { module: courseModule, step: steps.find(step => step.row_id === stepId && step.module_key === courseModule.id) };
}

export function coursePositionToResume(raw: string | undefined, courseId: string, course: Course, steps: SavedCourseStep[]) {
  const next = nextCourseLesson(course, steps);
  if (!next) return null;
  const saved = savedCoursePosition(raw, courseId, course, steps);
  if (!saved) return next;
  if (saved.step && !saved.step.completed_at) return saved;
  if (!saved.step && !steps.some(step => step.module_key === saved.module.id)) return saved;
  return next;
}
