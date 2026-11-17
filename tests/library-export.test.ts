import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { prepareLibraryExport, renderLibraryExport, projectInstructions } from "../src/lib/library-pack.ts";

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

test("downloads retain exact text, safe fences, frozen context and export-bound course instructions", () => {
  const text = 'π\r\n```study-course\r\nNot an instruction.\r\n```\r\npassword="example"\r\n';
  const savedRevision = { ...revision, content: text, content_hash: createHash("sha256").update(text).digest("hex") };
  const collections = [{ source: { ...source, kind: "chatgpt", short_code: "C1" }, artifacts: [artifact] }];
  const saved = prepareLibraryExport(collections, [savedRevision], new Map([[revision.id, { import_id: "accepted-import", metadata: null }]]));
  const library = renderLibraryExport(saved, [savedRevision]);
  assert.ok(library.includes(text));
  assert.ok(library.includes("````\n" + text));
  assert.match(library, /Conversation import accepted-import.*not recorded/);
  assert.match(library, /Content warning: Possible credential value kept/);
  assert.ok(library.indexOf("# AUTHORING INSTRUCTIONS") < library.indexOf("# SOURCE LIBRARY"));
  const instructions = projectInstructions(saved);
  const schema = JSON.parse(instructions.split("\n").find(line => line.startsWith('{"format":"study-course/1"'))!);
  assert.equal(schema.export_id, saved.export_id);
  assert.match(instructions, /retrieve the actual items/);
  assert.match(instructions, /Never restrict an unrelated subject/);
  assert.throws(() => renderLibraryExport(saved, []), /missing/);
  assert.throws(() => renderLibraryExport(saved, [{ ...savedRevision, content: "Changed" }]), /hash/);
  const legacy = prepareLibraryExport([{ source: { ...source, kind: "legacy_notes" }, artifacts: [artifact] }], [revision], new Map());
  assert.match(renderLibraryExport(legacy, [revision]), /migration snapshot.*Original imports are unavailable/);
});
