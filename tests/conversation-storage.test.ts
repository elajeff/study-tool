import test from "node:test";
import assert from "node:assert/strict";
import { parseConversationExport } from "../src/lib/conversation-import.ts";
import { createClient } from "@supabase/supabase-js";
import { prepareConversationEntries, loadConversationState } from "../src/lib/conversation-storage.ts";

const raw = JSON.stringify([{ uuid: "c", name: "Emoji 😀 and π", created_at: "2026-11-01T12:00:00Z", chat_messages: [
  { uuid: "m1", sender: "human", created_at: "2026-11-01T12:00:01Z", content: [{ type: "text", text: "Explain 😀 ≥ π" }] },
  { uuid: "m2", sender: "assistant", content: [{ type: "text", text: "Symbols are preserved." }] },
] }]);
test("storage uses exact UTF-8 message offsets, stable external identities and revision preview tokens", async () => {
  const parsed = parseConversationExport(raw, "claude"), chat = parsed.conversations[0];
  const [entry] = await prepareConversationEntries([chat], []);
  const bytes = new TextEncoder().encode(entry.content);
  for (const [index, message] of entry.metadata.messages.entries()) {
    const block = new TextDecoder("utf-8", { fatal: true }).decode(bytes.slice(message.start, message.end));
    assert.equal(block, `\n${message.role.toUpperCase()}\n${chat.messages[index].text}\n`);
  }
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hash = Buffer.from(digest).toString("hex");
  const [same] = await prepareConversationEntries([chat], [{ artifact_id: "saved", external_id: chat.id, revision_id: "revision", content_hash: hash }]);
  assert.equal(same.status, "Unchanged"); assert.equal(same.expected_revision_id, "revision"); assert.equal(same.artifact_id, "saved");
  assert.equal(entry.metadata.messages.at(-1)?.end, bytes.length);
  assert.ok(!("text" in entry.metadata.messages[0]));
  assert.equal(entry.metadata.created_at, "2026-11-01T12:00:00Z");
  assert.equal(entry.metadata.messages[0].created_at, "2026-11-01T12:00:01Z");
  assert.equal(entry.metadata.messages[1].created_at, null);
});

function savedConversationClient(failSecondPage = false) {
  const rows = Array.from({ length: 501 }, (_, index) => ({
    id: `artifact-${index}`, external_id: `chat-${index}`, current_revision_id: `revision-${index}`,
    revision: { content_hash: `hash-${index}` },
  }));
  return createClient("http://example.test", "fixture", {
    auth: { persistSession: false },
    global: { fetch: async input => {
      const url = new URL(String(input)), offset = Number(url.searchParams.get("offset"));
      assert.equal(url.searchParams.get("source_id"), "eq.selected-source");
      assert.equal(url.searchParams.get("limit"), "500");
      if (failSecondPage && offset) return Response.json({ message: "Unavailable" }, { status: 500 });
      return Response.json(rows.slice(offset, offset + 500));
    } },
  });
}

test("saved conversation identities include the next page from the selected source", async () => {
  const state = await loadConversationState(savedConversationClient(), "selected-source");
  assert.equal(state.length, 501);
  assert.deepEqual(state.at(-1), { artifact_id: "artifact-500", external_id: "chat-500", revision_id: "revision-500", content_hash: "hash-500" });
});

test("a failed later state page cannot classify saved conversations as new", async () => {
  await assert.rejects(loadConversationState(savedConversationClient(true), "selected-source"), /Could not load saved conversation identities/);
});
