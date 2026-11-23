import test from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { loadCourseSteps } from "../src/lib/course-queries.ts";

function fixture(failLaterPage = false) {
  const rows = Array.from({ length: 501 }, (_, index) => ({
    row_id: "lesson-" + index, id: "M01.S1", module: { key: "M01" }, completed_at: null,
  }));
  return createClient("http://example.test", "synthetic-key", { auth: { persistSession: false }, global: { fetch: async input => {
    const url = new URL(String(input));
    const offset = Number(url.searchParams.get("offset"));
    assert.equal(url.pathname, "/rest/v1/course_steps");
    assert.equal(url.searchParams.get("module.course_id"), "eq.course-a");
    if (failLaterPage && offset === 500) return Response.json({ message: "Unavailable" }, { status: 400 });
    return Response.json(rows.slice(offset, offset + Number(url.searchParams.get("limit"))));
  } } });
}

test("lesson loading keeps later pages and attaches the module key", async () => {
  const steps = await loadCourseSteps(fixture(), "course-a");
  assert.equal(steps.length, 501);
  assert.equal(steps.at(-1)?.row_id, "lesson-500");
  assert.equal(steps.at(-1)?.module_key, "M01");
});

test("a later lesson lookup failure cannot return a partial module plan", async () => {
  await assert.rejects(loadCourseSteps(fixture(true), "course-a"), /Could not load saved lesson steps/);
});
