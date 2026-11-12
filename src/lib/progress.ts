import type { Lesson } from "./curriculum.ts";

export const REVIEW_DAYS = [1, 1, 3, 7, 14, 30] as const;

export type Assessment = {
  id: string;
  topic: string;
  date: string;
  level: number;
  task: string;
  evidence: string;
  independent: boolean;
  hints: "none" | "minor" | "major" | "solution";
  artifact: string;
  next_step: string;
  status: "pending" | "approved" | "rejected";
  submitted_at: string;
  reviewed_at: string | null;
};

export function latestApproved(records: Assessment[]) {
  const latest = new Map<string, Assessment>();
  for (const record of [...records].filter((record) => record.status === "approved")
    .sort((a, b) => a.date.localeCompare(b.date)
      || (a.reviewed_at ?? "").localeCompare(b.reviewed_at ?? "")
      || a.id.localeCompare(b.id))) latest.set(record.topic, record);
  return latest;
}

export function demonstratedLessons(lessons: Lesson[], latest: Map<string, Assessment>) {
  return new Set(lessons.filter((lesson) => (latest.get(lesson.topic)?.level ?? -1) >= 3).map((lesson) => lesson.id));
}

export function progressStats(lessons: Lesson[], latest: Map<string, Assessment>) {
  const assessed = lessons.filter((lesson) => latest.has(lesson.topic)).length;
  const demonstrated = demonstratedLessons(lessons, latest).size;
  return { assessed, demonstrated, total: lessons.length };
}

export function reviewDate(record: Assessment) {
  const next = new Date(`${record.date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + REVIEW_DAYS[record.level]);
  return next.toISOString().slice(0, 10);
}

export function isDueForReview(record: Assessment, today = new Date()) {
  return reviewDate(record) <= today.toISOString().slice(0, 10);
}
