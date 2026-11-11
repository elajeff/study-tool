import test from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { loadAssessments } from "../src/lib/assessment-queries.ts";
import { latestApproved, type Assessment } from "../src/lib/progress.ts";

const receipt = (i: number, status: Assessment["status"] = "approved"): Assessment => ({
  id: String(i).padStart(6, "0"), topic: "Java", date: "2026-01-01", level: 4,
  status, reviewed_at: null, submitted_at: "2026-01-01T00:00:00Z",
  task: "Write a method", evidence: "Wrote and explained a fresh method",
  independent: true, hints: "none", artifact: "", next_step: "",
});

// Exercise the real Supabase query builder against a small PostgREST response fixture.
function database(rows: Assessment[], failAt?: number) {
  return createClient("https://example.supabase.co", "test-key", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async (input) => {
      const url = new URL(String(input));
      assert.equal(url.searchParams.get("order"), "id.asc");
      const offset = Number(url.searchParams.get("offset"));
      if (offset === failAt) return Response.json({ message: "Unavailable" }, { status: 400 });
      const status = url.searchParams.get("status")?.slice(3);
      const topic = url.searchParams.get("topic")?.slice(3);
      const selected = rows.filter((r) => r.status === status && (!topic || r.topic === topic));
      return Response.json(selected.slice(offset, offset + Number(url.searchParams.get("limit"))));
    } },
  });
}

test("mastery includes a later lower assessment beyond the first 1000 receipts", async () => {
  const rows = Array.from({ length: 1001 }, (_, i) => receipt(i));
  rows[1000] = { ...rows[1000], date: "2026-11-11", level: 1 };
  rows.push({ ...receipt(1001), topic: "SQL" }, receipt(1002, "pending"));
  const loaded = await loadAssessments(database(rows), "approved", "Java");
  assert.equal(loaded.length, 1001);
  assert.equal(latestApproved(loaded).get("Java")?.level, 1);
});

test("pending receipts remain accessible beyond 200 reviewed and 500 pending records", async () => {
  const rows = Array.from({ length: 501 }, (_, i) => receipt(i, "pending"));
  rows.push(...Array.from({ length: 201 }, (_, i) => receipt(i + 501)));
  const loaded = await loadAssessments(database(rows), "pending");
  assert.equal(loaded.length, 501);
  assert.equal(loaded.at(-1)?.id, rows[500].id);
});

test("a failed later page does not return incomplete assessment history", async () => {
  const rows = Array.from({ length: 501 }, (_, i) => receipt(i));
  await assert.rejects(loadAssessments(database(rows, 500), "approved"), /Could not load assessments/);
});
