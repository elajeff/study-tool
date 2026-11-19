import test from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { chatBridgeReference, matchChatReferences } from "../src/lib/chatbridge.ts";
import { readMarkdownFiles } from "../src/lib/obsidian.ts";
import JSZip from "jszip";

const id = "00000000-0000-4000-8000-000000000001";
const header = `---\nuuid: "${id}"\nurl: "https://chatgpt.com/c/${id}"\n---\n`;

test("ChatBridge recognition requires agreeing provider URL and frontmatter ID", () => {
  assert.deepEqual(chatBridgeReference(header + "Edited body"), { provider: "chatgpt", id });
  assert.deepEqual(chatBridgeReference(header.replace("chatgpt.com/c", "claude.ai/chat")), { provider: "claude", id });
  for (const text of [header.replace(id, "conflicting"), header.replace("chatgpt.com", "chatgpt.com.attacker.test"),
    "Body cites:\n" + header, header.replace("---\nuuid", `---\nuuid: ${id}\nuuid`),
    `---\napp: Codex\nsession: ${id}\n---\n`, "Same title, no provenance"])
    assert.equal(chatBridgeReference(text), null);
});

test("vault preview reports raw chat provenance while preserving notes copied elsewhere", async () => {
  const zip = new JSZip();
  zip.folder("Vault/.obsidian");
  zip.file("Vault/AI Chats/generated.md", header + "Raw chat");
  zip.file("Vault/Lessons/annotated.md", header + "My added notes");
  const parsed = await readMarkdownFiles([new File([await zip.generateAsync({ type: "uint8array" })], "vault.zip")]);
  assert.deepEqual(parsed.files.map(file => file.path), ["Lessons/annotated.md"]);
  assert.ok(parsed.files[0].body.endsWith("My added notes"));
  assert.equal(parsed.chatReferences.length, 2);
  assert.equal(parsed.skipped, 1);
});

test("reference lookup keeps providers separate and reports ambiguous saved copies without choosing one", async () => {
  const client = createClient("http://example.test", "synthetic-key", { auth: { persistSession: false }, global: {
    fetch: async input => {
      const url = new URL(String(input));
      const data = url.pathname.endsWith("/sources") ? [
        { id: "gpt-a", kind: "chatgpt", short_code: "C1" }, { id: "gpt-b", kind: "chatgpt", short_code: "C2" },
        { id: "claude", kind: "claude", short_code: "K1" },
      ] : [{ external_id: id, short_code: "T001", current_revision_id: "saved-revision" }];
      return new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });
    },
  } });
  const result = await matchChatReferences(client, [{ path: "a.md", provider: "chatgpt", id }, { path: "b.md", provider: "claude", id }]);
  assert.deepEqual(result.map(reference => reference.items.map(item => item.reference)), [["C1/T001", "C2/T001"], ["K1/T001"]]);
  assert.ok(result.every(reference => reference.items.every(item => item.revisionId === "saved-revision")));
  assert.deepEqual(await matchChatReferences(client, []), []);
});

test("reference lookup batches IDs and does not hide a failed later batch", async () => {
  const batches: number[] = [];
  let fail = false;
  const client = createClient("http://example.test", "synthetic-key", { auth: { persistSession: false }, global: {
    fetch: async input => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/sources")) return Response.json([{ id: "saved-source", kind: "chatgpt", short_code: "C1" }]);
      const ids = url.searchParams.get("external_id")!.slice(4, -1).split(",");
      batches.push(ids.length);
      return fail && ids.length === 1 ? new Response('{"message":"unavailable"}', { status: 500 })
        : Response.json(ids.map(external_id => ({ external_id, short_code: external_id, current_revision_id: null })));
    },
  } });
  const references = Array.from({ length: 101 }, (_, index) => ({ path: `${index}.md`, provider: "chatgpt" as const, id: `chat-${index}` }));
  assert.equal((await matchChatReferences(client, references)).length, 101);
  assert.deepEqual(batches, [100, 1]);
  fail = true;
  await assert.rejects(matchChatReferences(client, references), /Could not match/);
});
