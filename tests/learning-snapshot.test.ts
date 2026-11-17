import test from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { loadLearningSnapshot } from "../src/lib/learning-snapshot.ts";
test("learning card snapshot uses the later lower approved report and all course pages without inventing study progress", async () => {
  const client = createClient("http://example.test", "fixture", { auth: { persistSession: false }, global: {
    fetch: async input => {
      const url = new URL(String(input)), offset = Number(url.searchParams.get("offset") || 0);
      let data;
      if (url.pathname.endsWith("assessment_receipts")) {
        assert.equal(url.searchParams.get("status"), "eq.approved");
        data = Array.from({ length: offset ? 1 : 500 }, (_, index) => ({ id: `receipt-${offset + index}`, topic: "course-step:fixture",
          date: offset ? "2026-11-15" : "2026-11-14", level: offset ? 1 : 4, task: "Explain a leaf", status: "approved", reviewed_at: "2026-11-15" }));
      } else data = Array.from({ length: offset ? 1 : 500 }, (_, index) => ({ title: `Course ${offset + index}` }));
      return new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });
    },
  } });
  const state = await loadLearningSnapshot(client);
  assert.deepEqual(state.approved, [{ label: "Explain a leaf", level: 1, date: "2026-11-15" }]);
  assert.equal(state.courses.length, 501);
  assert.equal(state.courses.at(-1), "Course 500");
});
