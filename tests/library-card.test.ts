import test from "node:test";
import assert from "node:assert/strict";
import { buildLibraryCard, LIBRARY_CARD_CHARACTER_LIMIT } from "../src/lib/library-card.ts";

const source = { id: "source", kind: "chatgpt", short_code: "C1", name: "Plant chats" };
const artifacts = ["Orchids and irrigation", "Orchids and clay"].map((title, i) => ({ id: `a-${i}`, short_code: `T00${i+1}`,
  path: `${title} [provider-${i}]`, external_id: `provider-${i}`, current_revision_id: null }));

test("Library cards distinguish navigation hints, omitted history and reviewed reports", () => {
  const card = buildLibraryCard([{ source, artifacts }], []);
  assert.match(card, /"orchids"=2/);
  assert.ok(!card.includes("provider-"));
  assert.match(card, /not verified concepts or prerequisites/);
  assert.match(card, /LEARNING SNAPSHOT — not included/);
  assert.ok(!card.includes("0 latest approved"));
  const withHistory = buildLibraryCard([{ source, artifacts }], [], { approved: [{ label: "Sketch a leaf", level: 1, date: "2026-11-17" }], courses: ["Grow herbs"] });
  assert.match(withHistory, /0 at level 3 or higher/);
  assert.match(withHistory, /reviewed assessment reports, not machine verification/);
  assert.ok(withHistory.includes('"Grow herbs"'));
});

test("cards stay bounded with many sources and escaped learning labels", () => {
  const collections = Array.from({ length: 200 }, (_, i) => ({ source: { ...source, id: `s-${i}`, short_code: `C${i+1}` }, artifacts }));
  for (const learning of [undefined, { approved: Array.from({ length: 8 }, () => ({ label: "\0".repeat(120), level: 2, date: "2026-11-17" })), courses: Array(5).fill("\0".repeat(100)) }]) {
    const card = buildLibraryCard(collections, [], learning);
    assert.ok(card.length <= LIBRARY_CARD_CHARACTER_LIMIT);
    assert.match(card, /Some card details omitted/);
  }
});
