import test from "node:test";
import assert from "node:assert/strict";
import { parseConversationExport } from "../src/lib/conversation-import.ts";

test("malformed conversation shards identify the file that needs replacing", () => {
  assert.throws(() => parseConversationExport(["[]", "broken"], "chatgpt", ["first.json", "second.json"]), /second.json: invalid JSON/);
  assert.throws(() => parseConversationExport("{}", "claude", ["account.json"]), /account.json: select a conversations JSON array/);
});

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

test("broken branches are reported rather than guessed", () => {
  for (const mapping of [{ ...record.mapping, answer: { ...record.mapping.answer, parent: "missing" } },
    { ...record.mapping, answer: { ...record.mapping.answer, parent: "answer" } }])
    assert.equal(parseConversationExport(JSON.stringify([{ ...record, mapping }])).rejected.length, 1);
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
  const legacy = { uuid: "duplicate-message", sender: "human", text: "Question" };
  assert.equal(parseConversationExport(JSON.stringify([{ uuid: "claude", chat_messages: [legacy, legacy] }]), "claude").rejected.length, 1);
});

test("reading pages retain every character and split only before a new user turn", () => {
  const rows = ["question " + "π".repeat(24000), "answer one", "question two", "```txt\n" + "x".repeat(24000) + "\n```", "question three", "answer three"];
  const mapping = Object.fromEntries(rows.map((text, index) => [`m${index}`, {
    parent: index ? `m${index - 1}` : null,
    message: message(index % 2 ? "assistant" : "user", "text", [text]),
  }]));
  const chat = parseConversationExport(JSON.stringify([{ id: "long-chat", current_node: "m5", mapping }])).conversations[0];
  assert.equal(chat.pages.length, 3);
  assert.equal(chat.pages.map(page => chat.text.slice(page.start, page.end)).join(""), chat.text);
  for (const page of chat.pages.slice(1)) assert.ok(chat.messages.some(item => item.role === "user" && item.start === page.start));
  for (const item of chat.messages) assert.ok(chat.pages.some(page => page.start <= item.start && page.end >= item.end));
});

test("overlapping shards deduplicate identical copies and reject conflicting versions", () => {
  const raw = JSON.stringify([record]);
  const duplicate = parseConversationExport([raw, raw]);
  assert.equal(duplicate.conversations.length, 1);
  assert.equal(duplicate.duplicates, 1);
  const changed = JSON.stringify([{ ...record, title: "Changed title" }]);
  const conflict = parseConversationExport([raw, changed, raw]);
  assert.equal(conflict.conversations.length, 0);
  assert.equal(conflict.rejected.length, 3);
});
