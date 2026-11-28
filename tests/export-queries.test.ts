import test from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { loadExportManifest, loadExportRevisions, loadRepositoryOrigins } from "../src/lib/export-queries.ts";

test("revision loading batches selected IDs and enforces a combined UTF-8 byte limit", async () => {
  const ids = Array.from({ length: 501 }, (_, index) => `revision-${index}`), requests: URL[] = [];
  let large = false, fail = false;
  const client = createClient("http://example.test", "synthetic-key", { auth: { persistSession: false }, global: {
    fetch: async input => {
      const url = new URL(String(input)); requests.push(url);
      if (fail) return new Response('{"message":"unavailable"}', { status: 500 });
      const selected = url.searchParams.get("id")!.slice(4, -1).split(",");
      return Response.json(selected.map((id, index) => ({ id, artifact_id: `artifact-${id}`, content_hash: "fixture",
        content: large && index === 0 ? "π".repeat(9 * 1024 * 1024) : "small", import_id: "first-run" })));
    },
  } });
  const loaded = await loadExportRevisions(client, ["repository", "notes"], ids);
  assert.deepEqual(loaded.map(row => row.id), ids);
  assert.equal(loaded[0].import_id, "first-run");
  assert.ok(requests.every(url => !url.searchParams.get("select")!.includes("repository_origin")));
  assert.deepEqual(requests.map(url => url.searchParams.get("id")!.slice(4, -1).split(",").length), [100, 100, 100, 100, 100, 1]);
  assert.ok(requests.every(url => url.searchParams.get("source_id") === "in.(repository,notes)"));
  large = true;
  await assert.rejects(loadExportRevisions(client, ["repository", "notes"], ids), /35 MiB/);
  large = false; fail = true;
  await assert.rejects(loadExportRevisions(client, ["repository"], ids), /selected export revisions/);
});

test("repository origins load once for revisions from the same import", async () => {
  const origin = { format: "study-repository/1", kind: "archive", url: null, commit: null, excluded: ["generated.log"] };
  const client = createClient("http://example.test", "synthetic-key", { auth: { persistSession: false }, global: {
    fetch: async input => {
      const url = new URL(String(input));
      assert.equal(url.pathname, "/rest/v1/source_imports");
      assert.equal(url.searchParams.get("id"), "in.(first-run,old-run)");
      return Response.json([{ id: "first-run", repository_origin: origin }, { id: "old-run", repository_origin: null }]);
    },
  } });
  const origins = await loadRepositoryOrigins(client, new Set(["first-run", "first-run", "old-run"]));
  assert.deepEqual([...origins], [["first-run", origin]]);
});

test("missing snapshots return null while lookup failures remain errors", async () => {
  let fail = false;
  const client = createClient("http://example.test", "synthetic-key", { auth: { persistSession: false }, global: {
    fetch: async () => fail ? new Response('{"message":"unavailable"}', { status: 500 }) : Response.json(null),
  } });
  assert.equal(await loadExportManifest(client, "invalid"), null);
  assert.equal(await loadExportManifest(client, "X" + "a".repeat(64)), null);
  fail = true;
  await assert.rejects(loadExportManifest(client, "X" + "a".repeat(64)), /saved Library snapshot/);
});
