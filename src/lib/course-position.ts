import type { Course, SavedCourseStep } from "./course.ts";

export function savedCoursePosition(raw: string | undefined, courseId: string, course: Course, steps: SavedCourseStep[]) {
  const [savedId, index, stepId] = (raw ?? "").split(".");
  if (savedId !== courseId || !/^\d+$/.test(index ?? "")) return null;
  const courseModule = course.modules[Number(index)];
  if (!courseModule) return null;
  return { module: courseModule, step: steps.find(step => step.row_id === stepId && step.module_key === courseModule.id) };
}
