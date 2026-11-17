import test from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { loadLibraryDigests } from "../src/lib/digest-queries.ts";

test("digest loading preserves later pages and fails rather than returning partial cache history", async () => {
  let fail = false;
  const requests: URL[] = [];
  const client = createClient("http://example.test", "fixture", { auth: { persistSession: false }, global: {
    fetch: async input => {
      const url = new URL(String(input)); requests.push(url);
      const offset = Number(url.searchParams.get("offset") || 0);
      if (fail && offset === 500) return new Response('{"message":"failed page"}', { status: 400 });
      const data = Array.from({ length: offset ? 1 : 500 }, (_, index) => ({ id: `digest-${offset + index}`, revision_id: "revision", path: "path.md", summary: "Navigation", context: null }));
      return new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });
    },
  } });
  assert.equal((await loadLibraryDigests(client, ["revision"])).length, 501);
  assert.ok(requests.every(url => url.searchParams.get("revision_id") === "in.(revision)"));
  fail = true;
  await assert.rejects(loadLibraryDigests(client, ["revision"]), /digests/);
});

test("digest revision filters stay within request-line limits across UUID batches", async () => {
  const sizes: number[] = [];
  const ids = Array.from({ length: 101 }, (_, index) => `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`);
  const client = createClient("http://example.test", "fixture", { auth: { persistSession: false }, global: { fetch: async input => {
    const url = new URL(String(input));
    sizes.push(url.searchParams.get("revision_id")!.slice(4, -1).split(",").length);
    assert.ok(url.href.length < 5000);
    return Response.json([]);
  } } });
  assert.deepEqual(await loadLibraryDigests(client, ids), []);
  assert.deepEqual(sizes, [100, 1]);
});
