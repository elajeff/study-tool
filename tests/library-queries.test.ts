import test from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { loadLibrarySources } from "../src/lib/library-queries.ts";

function sourceClient(failSecondPage = false) {
  const sources = Array.from({ length: 501 }, (_, i) => ({
    id: `source-${i}`, name: `Source ${i}`, kind: "repository", short_code: `R${i + 1}`,
  }));
  return createClient("http://example.test", "fixture", {
    auth: { persistSession: false },
    global: { fetch: async input => {
      const url = new URL(String(input));
      const offset = Number(url.searchParams.get("offset"));
      assert.equal(url.searchParams.get("limit"), "500");
      if (failSecondPage && offset) return Response.json({ message: "Unavailable" }, { status: 500 });
      return Response.json(sources.slice(offset, offset + 500));
    } },
  });
}

test("Library source loading includes the next page", async () => {
  const sources = await loadLibrarySources(sourceClient());
  assert.equal(sources.length, 501);
  assert.equal(sources.at(-1)?.short_code, "R501");
});

test("a later source-page failure does not return a partial Library", async () => {
  await assert.rejects(loadLibrarySources(sourceClient(true)), /Could not load imported sources/);
});
