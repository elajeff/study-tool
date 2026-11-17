import test from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { loadCourseSteps } from "../src/lib/course-queries.ts";

function fixture(failLaterPage = false) {
  const modules = Array.from({ length: 101 }, (_, index) => ({ id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`, key: `M${index + 1}` }));
  const rows = modules.flatMap(selected => Array.from({ length: 12 }, (_, index) => ({ row_id: `${selected.key}-${index}`, id: `${selected.key}.S${index + 1}`,
    module_id: selected.id, position: index + 1, kind: "exercise", goal: "Calculate", sources: ["general"], done_when: "Explain the units",
    completed_at: index === 0 ? "2026-11-17T12:00:00Z" : null })));
  return createClient("http://example.test", "synthetic-key", { auth: { persistSession: false }, global: { fetch: async input => {
    const url = new URL(String(input)), offset = Number(url.searchParams.get("offset"));
    let selected;
    if (url.pathname.endsWith("course_modules")) {
      assert.equal(url.searchParams.get("course_id"), "eq.course-a"); selected = modules;
    } else {
      if (failLaterPage && offset === 500) return Response.json({ message: "Unavailable" }, { status: 400 });
      const ids = url.searchParams.get("module_id")!.slice(4, -1).split(",");
      assert.ok(ids.length <= 100, "UUID filters must fit request-line limits");
      selected = rows.filter(row => ids.includes(row.module_id));
    }
    return Response.json(selected.slice(offset, offset + Number(url.searchParams.get("limit"))));
  } } });
}

test("lesson loading retains all selected-course steps across result pages and UUID batches", async () => {
  const steps = await loadCourseSteps(fixture(), "course-a");
  assert.equal(steps.length, 1212);
  assert.equal(steps.at(-1)?.module_key, "M101");
  assert.equal(new Set(steps.map(step => step.row_id)).size, 1212);
  assert.equal(steps[0].completed_at, "2026-11-17T12:00:00Z");
  assert.equal(steps[1].completed_at, null);
});

test("a later lesson lookup failure cannot return a partial module plan", async () => {
  await assert.rejects(loadCourseSteps(fixture(true), "course-a"), /Could not load saved lesson steps/);
});
