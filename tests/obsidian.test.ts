import test from "node:test";
import assert from "node:assert/strict";
import JSZip from "jszip";
import { keepReviewedChoices, previewImport, readMarkdownFiles, type VaultState } from "../src/lib/obsidian.ts";

const current: VaultState = { artifact_id: "artifact-a", path: "Topic.md", revision_id: "revision-a",
  baseline_hash: "original", note_id: "note-a", note_hash: "original", note_body: "Current note" };

test("loose and archived Markdown preserve the same leading UTF-8 marker", async () => {
  const body = "\uFEFF# Topic\n";
  const zip = new JSZip();
  zip.file("Topic.md", body);
  const loose = await readMarkdownFiles([new File([body], "Topic.md")]);
  const archive = await readMarkdownFiles([new File([await zip.generateAsync({ type: "arraybuffer" })], "vault.zip")]);
  assert.equal(loose.files[0].body, body);
  assert.equal(loose.files[0].hash, archive.files[0].hash);
  assert.equal(previewImport(archive.files, [{ ...current, baseline_hash: loose.files[0].hash, note_hash: loose.files[0].hash }])[0].status, "Unchanged");

  const legacy = await readMarkdownFiles([new File([body.slice(1)], "Topic.md")]);
  const [review] = previewImport(loose.files, [{ ...current, baseline_hash: legacy.files[0].hash, note_hash: "local-edit" }]);
  assert.equal(review.status, "Conflict");
  assert.equal(review.decision, "");
});

test("preview separates accepted source text, local edits, deleted notes, and unconfirmed legacy snapshots", () => {
  const cases = [
    { changes: {}, incoming: "original", status: "Unchanged", decision: "keep" },
    { changes: {}, incoming: "updated", status: "Update", decision: "replace" },
    { changes: { note_hash: "local" }, incoming: "original", status: "Local edits kept", decision: "keep" },
    { changes: { note_hash: "local" }, incoming: "updated", status: "Conflict", decision: "" },
    { changes: { baseline_hash: null }, incoming: "updated", status: "Needs review", decision: "" },
    { changes: { baseline_hash: null }, incoming: "original", status: "Matches current note", decision: "keep" },
    { changes: { note_hash: null, note_id: null, baseline_hash: null }, incoming: "updated", status: "Deleted locally", decision: "" },
  ];
  for (const row of cases) {
    const [preview] = previewImport([{ path: "Topic.md", body: "Incoming", hash: row.incoming }], [{ ...current, ...row.changes }]);
    assert.equal(preview.status, row.status);
    assert.equal(preview.decision, row.decision);
  }
});

test("equal content does not infer a rename; explicit reconciliation keeps the artifact and rejects duplicate targets", () => {
  const file = { path: "Renamed.md", body: "Current note", hash: "original" };
  assert.equal(previewImport([file], [current])[0].previous, undefined);
  assert.equal(previewImport([file], [current], { "Renamed.md": current.artifact_id })[0].previous?.artifact_id, current.artifact_id);
  assert.throws(() => previewImport([file, { ...file, path: "Copy.md" }], [current], {
    "Renamed.md": current.artifact_id, "Copy.md": current.artifact_id,
  }), /same artifact/);
  assert.equal(previewImport([{ ...file, path: "topic.md" }], [current])[0].identityConflict, true);
});

test("matching a rename keeps the choice for an unchanged conflict and drops a stale choice", () => {
  const edited = { ...current, note_hash: "edited" };
  const oldFile = { ...current, artifact_id: "artifact-b", path: "Old.md" };
  const files = [
    { path: current.path!, body: "Incoming", hash: "incoming" },
    { path: "Renamed.md", body: "Original", hash: "original" },
  ];
  const reviewed = previewImport(files, [edited, oldFile]);
  const choices = { "Topic.md": "keep" } as const;
  const binding = { "Renamed.md": oldFile.artifact_id };
  assert.deepEqual(keepReviewedChoices(choices, reviewed, previewImport(files, [edited, oldFile], binding)), choices);
  assert.deepEqual(keepReviewedChoices(choices, reviewed,
    previewImport(files, [{ ...edited, note_hash: "edited-again" }, oldFile], binding)), {});
});

test("ZIP preview finds a marked vault, preserves text, and skips unsafe or private paths", async () => {
  const zip = new JSZip();
  zip.file("Vault/Lessons/Java/Methods.md", "# Methods\r\n\r\nReturn π.");
  zip.file("Vault/AI Chats/private.md", "Excluded");
  zip.file("Vault/Progress/report.md", "Excluded");
  zip.file("Vault/.obsidian/config.md", "Excluded");
  zip.file("Vault/../escape.md", "Excluded");
  zip.file("README.md", "Archive packaging note");
  zip.file(".hidden.md", "Excluded");
  zip.file(".trash/config.md", "Excluded");
  const result = await readMarkdownFiles([new File([await zip.generateAsync({ type: "arraybuffer" })], "vault.zip")]);
  assert.deepEqual(result.files.map((file) => file.path), ["Lessons/Java/Methods.md", "Progress/report.md"]);
  assert.equal(result.files[0].body, "# Methods\r\n\r\nReturn π.");
  assert.equal(result.skipped, 6);
  await assert.rejects(() => readMarkdownFiles([new File(["one"], "Topic.md"), new File(["two"], "topic.md")]), /Duplicate path/);
});

test("a ZIP without vault metadata keeps ordinary folders and omits nested chat transcripts", async () => {
  const zip = new JSZip();
  zip.file("README.md", "Introduction");
  zip.file("Biology/Foundations/Cells.md", "Cells");
  zip.file("Biology/AI Chats/transcript.md", "Chat");
  const file = new File([await zip.generateAsync({ type: "arraybuffer" })], "notes.zip");
  const result = await readMarkdownFiles([file]);
  assert.deepEqual(result.files.map(note => note.path), ["README.md", "Biology/Foundations/Cells.md"]);
  assert.equal(result.skipped, 1);
});

test("ZIP preview stops oversized decompression even when the archive understates its size", async () => {
  const zip = new JSZip();
  zip.file("Large.md", "x".repeat(8 * 1024 * 1024));
  zip.file("Small.md", "# Small\n\nKeep π and \uFEFF.");
  const bytes = await zip.generateAsync({ type: "arraybuffer", compression: "DEFLATE" });
  const view = new DataView(bytes);
  // The first central-directory entry and its local header falsely advertise one byte.
  const central = view.getUint32(bytes.byteLength - 22 + 16, true);
  view.setUint32(central + 24, 1, true);
  view.setUint32(view.getUint32(central + 42, true) + 22, 1, true);
  const result = await readMarkdownFiles([new File([bytes], "understated.zip")]);
  assert.deepEqual(result.files.map(({ path, body }) => ({ path, body })), [{ path: "Small.md", body: "# Small\n\nKeep π and \uFEFF." }]);
  assert.equal(result.skipped, 1);
});
