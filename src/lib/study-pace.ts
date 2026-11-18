export type StudyPace = { hoursPerDay: number; daysPerWeek: number; minutesPerLesson: number };
export function parseStudyPace(raw: string | undefined): StudyPace | null {
  const values = (raw ?? "").split(".");
  if (values.length !== 3) return null;
  const [dailyMinutes, daysPerWeek, minutesPerLesson] = values.map(Number);
  if (!Number.isInteger(dailyMinutes) || dailyMinutes < 6 || dailyMinutes > 960 || !Number.isInteger(daysPerWeek) || daysPerWeek < 1 || daysPerWeek > 7
    || !Number.isInteger(minutesPerLesson) || minutesPerLesson < 5 || minutesPerLesson > 240) return null;
  return { hoursPerDay: dailyMinutes / 60, daysPerWeek, minutesPerLesson };
}
