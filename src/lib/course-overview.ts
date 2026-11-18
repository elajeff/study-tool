import type { Course, SavedCourseStep } from "./course.ts";

export function courseOverview(course: Course, steps: SavedCourseStep[], minutesPerLesson: number, hoursPerWeek: number | null) {
  let completedModules = 0, unplannedModules = 0, remainingLessons = 0;
  for (const courseModule of course.modules) {
    const planned = steps.filter(step => step.module_key === courseModule.id);
    if (!planned.length) { unplannedModules++; remainingLessons += courseModule.steps_estimate; }
    else {
      const remaining = planned.filter(step => !step.completed_at).length;
      remainingLessons += remaining;
      if (!remaining) completedModules++;
    }
  }
  const remainingHours = remainingLessons * minutesPerLesson / 60;
  return { completedModules, unplannedModules, remainingLessons, remainingHours,
    plannedLessons: steps.length, completedLessons: steps.filter(step => step.completed_at).length,
    calendarDays: hoursPerWeek ? Math.ceil(remainingHours / hoursPerWeek * 7) : null };
}
