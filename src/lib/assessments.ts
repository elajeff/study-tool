import { createHash } from "node:crypto";

export type Evidence = {
  topic: string;
  date: string;
  level: number;
  task: string;
  evidence: string;
  independent: boolean;
  hints: "none" | "minor" | "major" | "solution";
  artifact: string;
  next_step: string;
  step?: string;
};

const blocks = /^```study-evidence\s*\r?\n([\s\S]*?)^```\s*$/gm;

function isDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
}

export function validateEvidence(value: unknown): Evidence {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Receipt must be a JSON object.");
  const item = value as Record<string, unknown>;
  if (typeof item.topic !== "string" || !item.topic.trim() || item.topic.length > 240)
    throw new Error("Use the topic reference supplied in the lesson's tutor context.");
  if (!isDate(item.date)) throw new Error("The assessment date must use YYYY-MM-DD.");
  if (!Number.isInteger(item.level) || (item.level as number) < 0 || (item.level as number) > 5)
    throw new Error("Mastery must be between 0 and 5.");
  const fields = ["task", "evidence", "artifact", "next_step"] as const;
  for (const field of fields) {
    if (typeof item[field] !== "string" || item[field].length > 3000)
      throw new Error(`Invalid ${field} field.`);
  }
  if (!(item.task as string).trim() || (item.evidence as string).trim().length < 15)
    throw new Error("Describe the task and the work you actually demonstrated.");
  if (typeof item.independent !== "boolean" || !["none", "minor", "major", "solution"].includes(String(item.hints)))
    throw new Error("Specify whether the work was independent and which hints were used.");
  if ((item.level as number) >= 3 && (!item.independent || !["none", "minor"].includes(item.hints as string)))
    throw new Error("Level 3 requires independent work without a supplied solution.");
  if ((item.level as number) >= 4 && (item.hints !== "none" || !(item.artifact as string).trim()))
    throw new Error("Level 4 or 5 requires an artifact and no hints.");
  if (item.step !== undefined && (typeof item.step !== "string" || !/^[a-f\d]{8}(-[a-f\d]{4}){3}-[a-f\d]{12}$/.test(item.step)))
    throw new Error("Use the persistent step ID supplied in the lesson card.");
  if (item.step !== undefined ? item.topic !== `course-step:${item.step}` : item.topic.startsWith("course-step:"))
    throw new Error("A course receipt's topic must match its persistent step ID.");
  const receipt = Object.fromEntries(["topic", "date", "level", ...fields, "independent", "hints"].map((key) => [key, item[key]])) as Evidence;
  return item.step === undefined ? receipt : { ...receipt, step: item.step };
}

export function parseEvidence(text: string) {
  if (text.length > 300_000) throw new Error("Assessment text is too large.");
  const found = [...text.matchAll(blocks)].map((match) => match[1]);
  if (!found.length) {
    try { return [validateEvidence(JSON.parse(text))]; }
    catch { throw new Error("Paste a study-evidence JSON block or a valid receipt object."); }
  }
  if (found.length > 20) throw new Error("Import no more than 20 receipts at once.");
  return found.map((raw) => {
    try { return validateEvidence(JSON.parse(raw)); }
    catch (error) { throw new Error(error instanceof Error ? error.message : "Invalid assessment receipt."); }
  });
}

export function evidenceFingerprint(item: Evidence) {
  return createHash("sha256").update(JSON.stringify(item)).digest("hex");
}
