import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { prepareLibraryExport } from "../src/lib/library-pack.ts";

const source = { id: "repository", short_code: "R1", kind: "repository", name: "Synthetic project" };
const artifact = { id: "file", short_code: "F001", path: "example.py", external_id: null, current_revision_id: "revision" };
const content = "# π\r\ndef add(a, b): return a + b\r\n";
const revision = { id: "revision", artifact_id: "file", content, content_hash: createHash("sha256").update(content).digest("hex") };

test("snapshots keep mixed-source identities and hashes stable regardless of selection order", () => {
  const notes = { ...source, id: "notes", short_code: "V1", kind: "obsidian" };
  const note = { ...artifact, id: "note", short_code: "N001", current_revision_id: "note-revision" };
  const noteRevision = { ...revision, id: "note-revision", artifact_id: "note" };
  const collections = [{ source, artifacts: [artifact] }, { source: notes, artifacts: [note] }];
  const revisions = [revision, noteRevision];
  const saved = prepareLibraryExport(collections, revisions, new Map());
  assert.match(saved.export_id, /^X[a-f0-9]{64}$/);
  assert.deepEqual(saved.items.map(item => item.id), ["R1/F001", "V1/N001"]);
  assert.ok(saved.maps.some(map => map.id === "R1/MAP/1"));
  assert.ok(saved.maps.some(map => map.id === "V1/MAP/1"));
  assert.equal(prepareLibraryExport([...collections].reverse(), [...revisions].reverse(), new Map()).export_id, saved.export_id);
  assert.notEqual(prepareLibraryExport([{ source, artifacts: [{ ...artifact, path: "renamed.py" }] }], [revision], new Map()).export_id,
    prepareLibraryExport([collections[0]], [revision], new Map()).export_id);
  assert.throws(() => prepareLibraryExport([collections[0]], [], new Map()), /matching revision/);
  assert.throws(() => prepareLibraryExport([collections[0]], [{ ...revision, content: "changed" }], new Map()), /hash/);
  assert.throws(() => prepareLibraryExport([collections[0], collections[0]], [revision], new Map()), /distinct/);
});

test("snapshots bind chat context to the selected revision even when text is unchanged", () => {
  const chat = { ...source, kind: "chatgpt", short_code: "C1" };
  const collections = [{ source: chat, artifacts: [{ ...artifact, short_code: "T001" }] }];
  const first = prepareLibraryExport(collections, [revision], new Map([[revision.id, { import_id: "first", metadata: null }]]));
  const second = prepareLibraryExport(collections, [revision], new Map([[revision.id, { import_id: "second", metadata: null }]]));
  assert.equal(first.items[0].conversation?.import_id, "first");
  assert.notEqual(first.export_id, second.export_id);
  assert.throws(() => prepareLibraryExport(collections, [revision], new Map()), /accepted import context/);
});
