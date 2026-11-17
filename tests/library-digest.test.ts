import test from "node:test";
import assert from "node:assert/strict";
import { parseDigest, currentLibraryDigests, type LibraryDigest } from "../src/lib/library-digest.ts";
import type { ExportManifest } from "../src/lib/library-pack.ts";
import type { ConversationContext } from "../src/lib/conversation-context.ts";

const artifact = { id: "plant", short_code: "N001", current_revision_id: "rev", path: "Seeds/sowing.md", external_id: null };
const manifest: ExportManifest = { format: "study-export/3", export_id: "X" + "a".repeat(64), sources: [], maps: [],
  items: [{ id: "V1/N001", source_id: "source", artifact_id: "plant", revision_id: "rev", path: artifact.path, content_hash: "fixture" }] };
const payload = { format: "study-digest/1", export_id: manifest.export_id, items: [{ id: "V1/N001", summary: "Notes about sowing seeds." }] };
test("digests require exact export identity and distinct real items, not maps or general knowledge", () => {
  assert.equal(parseDigest(JSON.stringify(payload), manifest).items[0].summary, payload.items[0].summary);
  assert.equal(parseDigest(`Prose\n\`\`\`json\n${JSON.stringify(payload)}\n\`\`\``, manifest).items.length, 1);
  for (const changed of [{ ...payload, export_id: undefined }, { ...payload, export_id: "other" }, { ...payload, items: [payload.items[0], payload.items[0]] },
    { ...payload, items: [{ ...payload.items[0], id: "V1/MAP/1" }] }, { ...payload, items: [{ ...payload.items[0], id: "general" }] }])
    assert.throws(() => parseDigest(JSON.stringify(changed), manifest), /export|IDs/);
  for (const summary of ["", "x".repeat(201), "first\nsecond", "-----BEGIN PRIVATE KEY-----"])
    assert.throws(() => parseDigest(JSON.stringify({ ...payload, items: [{ id: "V1/N001", summary }] }), manifest), /summary|line|credential/);
  assert.equal(Array.from(parseDigest(JSON.stringify({ ...payload, items: [{ id: "V1/N001", summary: "😀".repeat(200) }] }), manifest).items[0].summary).length, 200);
});

test("current summaries select the latest matching version and reject changed paths or text", () => {
  const candidates: LibraryDigest[] = [{ id: "new", revision_id: "rev", path: artifact.path, context: null, summary: "Corrected navigation." },
    { id: "old", revision_id: "rev", path: artifact.path, context: null, summary: "Earlier navigation." }];
  assert.equal(currentLibraryDigests([artifact], new Map(), candidates).get("plant")?.id, "new");
  assert.equal(currentLibraryDigests([{ ...artifact, path: "New/path.md" }], new Map(), candidates).size, 0);
  assert.equal(currentLibraryDigests([{ ...artifact, current_revision_id: "changed" }], new Map(), candidates).size, 0);
});

test("chat cache matches reconstruction metadata independent of import ID and JSON key order", () => {
  const metadata = { created_at: 1, updated_at: 2, visible_messages: 3, redactions: 0, excluded: { tools: 2, thoughts: 3 } };
  const candidates = [{ id: "digest", revision_id: "rev", path: artifact.path, context: metadata, summary: "Visible chat topics." }];
  const contexts = new Map<string, ConversationContext>([["rev", { import_id: "new-import", metadata: { ...metadata, excluded: { thoughts: 3, tools: 2 } } }]]);
  assert.equal(currentLibraryDigests([artifact], contexts, candidates).get("plant")?.id, "digest");
  contexts.set("rev", { import_id: "other", metadata: { ...metadata, updated_at: 4 } });
  assert.equal(currentLibraryDigests([artifact], contexts, candidates).size, 0);
});
