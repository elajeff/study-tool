import test from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { loadConversationContexts } from "../src/lib/conversation-queries.ts";
import { conversationContextText, sourceTimeText } from "../src/lib/conversation-context.ts";

test("conversation dates retain their source units and missing metadata stays explicit", () => {
  assert.equal(sourceTimeText(null), "unknown");
  assert.equal(sourceTimeText(1234), "1234 (Unix seconds)");
  assert.equal(sourceTimeText("2026-11-01T00:00:00Z"), '"2026-11-01T00:00:00Z"');
  assert.match(conversationContextText({ import_id: "older-import", metadata: null }), /were not recorded/);
  const text = conversationContextText({ import_id: "accepted-import", metadata: {
    created_at: 1234, updated_at: null, visible_messages: 2, excluded: { hidden_messages: 3 }, redactions: 1,
  } });
  assert.match(text, /Visible messages: 2/);
  assert.match(text, /"hidden_messages"=3/);
  assert.match(text, /do not establish original completeness or correctness/);
});

test("conversation context loading batches selected revision IDs and reports lookup failures", async () => {
  const ids = Array.from({ length: 501 }, (_, index) => `revision-${index}`), batches: string[][] = [];
  let fail = false;
  const client = createClient("http://example.test", "synthetic-key", { auth: { persistSession: false }, global: {
    fetch: async (_input, init) => {
      const selected = JSON.parse(String(init?.body)).p_revision_ids as string[];
      batches.push(selected);
      return fail ? new Response('{"message":"unavailable"}', { status: 500 }) : new Response(JSON.stringify(selected.map(revision_id =>
        ({ revision_id, context: { import_id: `import-${revision_id}`, metadata: null } }))), { headers: { "Content-Type": "application/json" } });
    },
  } });
  const contexts = await loadConversationContexts(client, ids);
  assert.deepEqual(batches.map(batch => batch.length), [500, 1]);
  assert.equal(contexts.size, 501);
  assert.equal(contexts.get("revision-500")?.import_id, "import-revision-500");
  fail = true;
  await assert.rejects(loadConversationContexts(client, ["revision"]), /context/);
});
