import test from "node:test";
import assert from "node:assert/strict";
import { validateEvidence, parseEvidence, evidenceFingerprint } from "../src/lib/assessments.ts";
import { latestApproved, reviewDate, isDueForReview, type Assessment } from "../src/lib/progress.ts";

const evidence = {
  topic: "Lessons/Java/06 Methods", date: "2026-11-10", level: 3,
  task: "Write a method that finds the larger of two numbers",
  evidence: "Wrote the method independently and checked equal inputs.",
  independent: true, hints: "minor", artifact: "", next_step: "Try an array method",
};

function record(id: string, status: Assessment["status"], date: string, level: number): Assessment {
  return { ...evidence, id, status, date, level, hints: "minor", submitted_at: `${date}T00:00:00Z`, reviewed_at: `${date}T01:00:00Z` };
}

test("receipts are parsed and identifying fields are stable", () => {
  const first = validateEvidence(evidence);
  assert.deepEqual(parseEvidence(`Before\n\`\`\`study-evidence\n${JSON.stringify(evidence)}\n\`\`\`\nAfter`), [first]);
  assert.equal(evidenceFingerprint(first), evidenceFingerprint(validateEvidence({ ...evidence, status: "approved" })));
});

test("independent work is required for level 3 and an artifact for level 4", () => {
  assert.throws(() => validateEvidence({ ...evidence, independent: false }), /Level 3/);
  assert.throws(() => validateEvidence({ ...evidence, level: 4 }), /Level 4/);
  assert.throws(() => validateEvidence({ ...evidence, date: "2026-02-30" }), /date/);
  assert.throws(() => validateEvidence({ ...evidence, level: 6 }), /Mastery/);
});

test("only approved records determine mastery, including a later lower score", () => {
  const pending = record("3", "pending", "2026-11-12", 5);
  const earlier = record("1", "approved", "2026-11-10", 4);
  const later = record("2", "approved", "2026-11-11", 2);
  const latest = latestApproved([pending, later, earlier]);
  assert.equal(latest.get(evidence.topic)?.level, 2);
  assert.equal(reviewDate(later), "2026-11-14");
  assert.equal(isDueForReview(later, new Date("2026-11-14T12:00:00Z")), true);
});
