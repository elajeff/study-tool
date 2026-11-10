export type Progress = {
  lesson_id: string;
  status: "not_started" | "studying" | "completed";
  mastery: number;
  reflection: string;
  updated_at: string;
};

export function progressStats(lessonIds: string[], progress: Progress[]) {
  const relevant = progress.filter((row) => lessonIds.includes(row.lesson_id));
  const completed = relevant.filter((row) => row.status === "completed").length;
  const studying = relevant.filter((row) => row.status === "studying").length;
  return { completed, studying, total: lessonIds.length, percent: Math.round(completed / Math.max(1, lessonIds.length) * 100) };
}

export function isDueForReview(record: Progress, now = new Date()) {
  if (record.status === "not_started") return false;
  const elapsedDays = (now.valueOf() - new Date(record.updated_at).valueOf()) / 86_400_000;
  return elapsedDays >= (record.mastery >= 4 ? 14 : 7);
}
