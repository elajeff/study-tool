import test from "node:test";
import assert from "node:assert/strict";
import { parseConversationExport } from "../src/lib/conversation-import.ts";

const message = (role: string, content_type: string, parts: unknown[], extra = {}) => ({ author: { role }, content: { content_type, parts }, ...extra });
const record = { id: "conversation", title: "Synthetic branch", current_node: "answer", mapping: {
  root: { parent: null, message: null },
  user: { parent: "root", message: message("user", "multimodal_text", ["Explain π² ≥ 0", { content_type: "image_asset_pointer", asset_pointer: "never serialize" }]) },
  thought: { parent: "user", message: message("assistant", "thoughts", ["hidden reasoning"]) },
  hidden: { parent: "thought", message: message("assistant", "text", ["private hidden text"], { metadata: { is_visually_hidden_from_conversation: true } }) },
  answer: { parent: "hidden", message: message("assistant", "text", ["Visible answer: π² ≥ 0\r\n```py\r\na = 1\r\n```\r\n"]) },
  sibling: { parent: "user", message: message("assistant", "text", ["unselected answer"]) },
} };

test("active branch retains answers after thoughts, exact math/code and structural attachment markers", () => {
  const result = parseConversationExport(JSON.stringify([record])), chat = result.conversations[0];
  assert.equal(result.rejected.length, 0);
  assert.deepEqual(chat.messages.map(item => item.id), ["user", "answer"]);
  assert.equal(chat.messages[1].text, record.mapping.answer.message.content.parts[0]);
  assert.match(chat.text, /\[image not analyzed\]/);
  for (const omitted of ["hidden reasoning", "private hidden text", "unselected answer", "never serialize"]) assert.ok(!chat.text.includes(omitted));
  assert.equal(chat.excluded.other_branch_nodes, 1);
  assert.equal(chat.excluded.thoughts, 1);
  assert.equal(chat.excluded.hidden_messages, 1);
});

test("broken branches are reported rather than guessed, duplicate copies do not merge conflicting answers", () => {
  for (const mapping of [{ ...record.mapping, answer: { ...record.mapping.answer, parent: "missing" } },
    { ...record.mapping, answer: { ...record.mapping.answer, parent: "answer" } }])
    assert.equal(parseConversationExport(JSON.stringify([{ ...record, mapping }])).rejected.length, 1);
  assert.equal(parseConversationExport(JSON.stringify([record, record])).duplicates, 1);
  const changed = { ...record, mapping: { ...record.mapping, answer: { ...record.mapping.answer, message: message("assistant", "text", ["Different answer"]) } } };
  const conflict = parseConversationExport(JSON.stringify([record, changed]));
  assert.equal(conflict.rejected.length, 2); assert.equal(conflict.conversations.length, 0);
});

test("credential redaction preserves example values, original input and long code blocks", () => {
  const secret = "sk-" + "x".repeat(28), long = "```txt\n" + "≤π\n".repeat(9000) + "```";
  const input = { ...record, mapping: { ...record.mapping, answer: { ...record.mapping.answer, message: message("assistant", "text", [`${secret}\npassword="synthetic-only"\n${long}`]) } } };
  const original = JSON.stringify(input), chat = parseConversationExport(`[${original}]`).conversations[0];
  assert.ok(!chat.text.includes(secret)); assert.ok(chat.text.includes('password="synthetic-only"'));
  assert.ok(chat.text.includes(long)); assert.equal(chat.redactions, 1);
  assert.equal(JSON.stringify(input), original);
});

test("Claude mixed blocks exclude tools and thinking without falling back to duplicate legacy text", () => {
  const rows = [{ uuid: "a", parent_message_uuid: "root-sentinel", sender: "human", content: [{ type: "text", text: "Question" }] },
    { uuid: "b", parent_message_uuid: "a", sender: "assistant", text: "Do not fall back", content: [{ type: "thinking", thinking: "hidden" }, { type: "tool_result", content: "private tool output" }, { type: "text", text: "Real answer" }] }];
  const result = parseConversationExport(JSON.stringify([{ uuid: "claude", name: "Synthetic", chat_messages: [...rows].reverse() }]), "claude");
  assert.equal(result.rejected.length, 0);
  assert.deepEqual(result.conversations[0].messages.map(item => item.text), ["Question", "Real answer"]);
  const branch = { ...rows[1], uuid: "c" };
  assert.equal(parseConversationExport(JSON.stringify([{ uuid: "claude", chat_messages: [...rows, branch] }]), "claude").rejected.length, 1);
});
