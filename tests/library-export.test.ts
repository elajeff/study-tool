import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { prepareLibraryExport, projectInstructions } from "../src/lib/library-pack.ts";
import { buildLibraryFiles, LIBRARY_FILE_BYTES, LibraryFileSizeError } from "../src/lib/library-files.ts";

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
  const files = buildLibraryFiles(saved, [savedRevision]);
  assert.equal(files.length, 1);
  const library = files[0].text;
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
  assert.throws(() => buildLibraryFiles(saved, []), /missing/);
  assert.throws(() => buildLibraryFiles(saved, [{ ...savedRevision, content: "Changed" }]), /hash/);
  const legacy = prepareLibraryExport([{ source: { ...source, kind: "legacy_notes" }, artifacts: [artifact] }], [revision], new Map());
  assert.match(buildLibraryFiles(legacy, [revision])[0].text, /migration snapshot.*Original imports are unavailable/);
});

test("large downloads bound UTF-8 bytes, index every item once and never cut source text", () => {
  const artifacts = Array.from({ length: 3 }, (_, index) => ({ ...artifact, id: `file-${index}`, short_code: `F00${index}`, current_revision_id: `revision-${index}` }));
  const revisions = artifacts.map((item, index) => {
    const content = "π".repeat(350000) + `\nDifferent example ${index}\n`;
    return { ...revision, id: item.current_revision_id, artifact_id: item.id, content, content_hash: createHash("sha256").update(content).digest("hex") };
  });
  const saved = prepareLibraryExport([{ source, artifacts }], revisions, new Map());
  const files = buildLibraryFiles(saved, revisions);
  assert.equal(files.length, 3);
  assert.ok(files.every(file => Buffer.byteLength(file.text, "utf8") <= LIBRARY_FILE_BYTES));
  assert.match(files[0].text, /# FILE INDEX/);
  for (const [index, item] of saved.items.entries()) {
    assert.equal(files.slice(1).filter(file => file.text.includes(`END ITEM ${item.id}`)).length, 1);
    assert.ok(files.some(file => file.text.includes(revisions[index].content)));
    assert.ok(files[0].text.includes(item.id));
  }
  const content = "界".repeat(500000);
  const huge = { ...revision, content, content_hash: createHash("sha256").update(content).digest("hex") };
  const single = prepareLibraryExport([{ source, artifacts: [artifact] }], [huge], new Map());
  assert.throws(() => buildLibraryFiles(single, [huge]), LibraryFileSizeError);
});
