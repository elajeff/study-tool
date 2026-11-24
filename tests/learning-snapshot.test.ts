import test from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { loadLearningSnapshot } from "../src/lib/learning-snapshot.ts";

test("learning history reads recent saved titles and uses the full course count", async () => {
  const client = createClient("http://example.test", "fixture", { auth: { persistSession: false }, global: {
    fetch: async input => {
      const url = new URL(String(input));
      assert.equal(url.pathname, "/rest/v1/courses");
      assert.equal(url.searchParams.get("limit"), "5");
      return Response.json([{ title: "Ratios" }, { display_name: "My course", title: "Original title" }],
        { headers: { "Content-Range": "0-1/12" } });
    },
  } });
  assert.deepEqual(await loadLearningSnapshot(client), { count: 12, courses: ["Ratios", "My course"] });
});
