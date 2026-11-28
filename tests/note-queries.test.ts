import test from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { loadNoteList, loadNotes, loadNoteTopicReferences } from "../src/lib/note-queries.ts";

test("note search requests one page and treats punctuation as literal text", async () => {
  const rows = Array.from({ length: 51 }, (_, index) => ({ id: "note-" + index, title: 'C++ (draft), "notes"' }));
  const client = createClient("http://example.test", "fixture", {
    auth: { persistSession: false },
    global: { fetch: async input => {
      const query = new URL(String(input)).searchParams;
      assert.equal(query.get("offset"), "50");
      assert.equal(query.get("limit"), "51");
      const pattern = JSON.stringify('C\\+\\+ \\(draft\\), "notes"');
      assert.equal(query.get("or"), "(path.imatch." + pattern + ",title.imatch." + pattern + ")");
      return Response.json(rows);
    } },
  });
  const result = await loadNoteList(client, 'C++ (draft), "notes"', 2);
  assert.deepEqual(result.notes, rows.slice(0, 50));
  assert.equal(result.hasNextPage, true);
});

test("topic lookup reads only note identities before loading the selected vault", async () => {
  const row = { id: "note", source_id: "vault", artifact_id: "artifact", artifact: { legacy_topic: "Topics/Old name" } };
  const client = createClient("http://example.test", "fixture", { global: { fetch: async input => {
    const query = new URL(String(input)).searchParams;
    if (query.has("source_id")) {
      assert.equal(query.get("source_id"), "eq.vault");
      return Response.json([{ ...row, body: "Note text", artifact: { ...row.artifact, source: { name: "Vault" } } }]);
    }
    assert.doesNotMatch(query.get("select")!, /body/);
    return Response.json([row]);
  } } });
  const [reference] = await loadNoteTopicReferences(client);
  assert.deepEqual(reference, { sourceId: "vault", topic: "Topics/Old name" });
  const [note] = await loadNotes(client, reference.sourceId);
  assert.equal(note.topic, reference.topic);
  assert.equal(note.body, "Note text");
});
