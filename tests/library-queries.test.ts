import test from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { loadLibrarySources, loadLibraryArtifacts } from "../src/lib/library-queries.ts";

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

function artifactClient(failSecondPage = false) {
  const artifacts = Array.from({ length: 501 }, (_, i) => ({
    id: `item-${i}`, short_code: `F${i + 1}`, path: `file-${i}.md`, external_id: null,
    current_revision_id: `revision-${i}`,
  }));
  return createClient("http://example.test", "fixture", {
    auth: { persistSession: false },
    global: { fetch: async input => {
      const url = new URL(String(input));
      assert.equal(url.pathname, "/rest/v1/source_artifacts");
      assert.equal(url.searchParams.get("source_id"), "eq.selected-source");
      const offset = Number(url.searchParams.get("offset"));
      assert.equal(url.searchParams.get("limit"), "500");
      if (failSecondPage && offset) return Response.json({ message: "Unavailable" }, { status: 500 });
      return Response.json(artifacts.slice(offset, offset + 500));
    } },
  });
}

test("Library items stay scoped to the selected source across pages", async () => {
  const items = await loadLibraryArtifacts(artifactClient(), "selected-source");
  assert.equal(items.length, 501);
  assert.equal(items.at(-1)?.current_revision_id, "revision-500");
});

test("a later item-page failure does not return a partial source", async () => {
  await assert.rejects(loadLibraryArtifacts(artifactClient(true), "selected-source"), /Could not load saved source items/);
});

test("a later source-page failure does not return a partial Library", async () => {
  await assert.rejects(loadLibrarySources(sourceClient(true)), /Could not load imported sources/);
});
