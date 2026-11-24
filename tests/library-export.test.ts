import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { prepareLibraryExport, projectInstructions } from "../src/lib/library-pack.ts";
import { buildLibraryFiles, LIBRARY_FILE_BYTES, LibraryFileSizeError } from "../src/lib/library-files.ts";
import { MAP_CHARACTER_LIMIT } from "../src/lib/library-map.ts";
import { selectLibraryArtifacts } from "../src/lib/library-queries.ts";

const source = { id: "repository", short_code: "R1", kind: "repository", name: "Synthetic project" };
const artifact = { id: "file", short_code: "F001", path: "example.py", external_id: null, current_revision_id: "revision" };
const content = "# π\r\ndef add(a, b): return a + b\r\n";
const revision = { id: "revision", artifact_id: "file", content, content_hash: createHash("sha256").update(content).digest("hex") };

test("exported summaries freeze matching versions without replacing source text or changing empty-cache snapshots", () => {
  const collections = [{ source, artifacts: [artifact] }];
  const original = prepareLibraryExport(collections, [revision], new Map());
  assert.equal(prepareLibraryExport(collections, [revision], new Map(), []).export_id, original.export_id);
  const candidates = [{ id: "summary-1", revision_id: revision.id, path: artifact.path, context: null, summary: "An unverified arithmetic function." }];
  const saved = prepareLibraryExport(collections, [revision], new Map(), candidates);
  assert.notEqual(saved.export_id, original.export_id);
  assert.equal(saved.digests?.[0].digest_id, "summary-1");
  assert.ok(saved.maps.some(map => map.text.includes("AI summary, unverified")));
  assert.ok(buildLibraryFiles(saved, [revision]).some(file => file.text.includes(content)));
  assert.ok(!original.maps.some(map => map.text.includes(candidates[0].summary)));
  candidates.unshift({ ...candidates[0], id: "summary-2", summary: "Corrected navigation." });
  assert.equal(prepareLibraryExport(collections, [revision], new Map(), candidates).digests?.[0].digest_id, "summary-2");
  assert.equal(saved.digests?.[0].digest_id, "summary-1");
});

test("long Unicode summaries keep all items reachable within map size limits", () => {
  const artifacts = Array.from({ length: 100 }, (_, i) => ({ ...artifact, id: `a-${i}`, short_code: `F${i+1}`, current_revision_id: `r-${i}` }));
  const revisions = artifacts.map(item => ({ ...revision, id: item.current_revision_id, artifact_id: item.id }));
  const digests = artifacts.map(item => ({ id: `d-${item.id}`, revision_id: item.current_revision_id, path: item.path, context: null, summary: "😀".repeat(200) }));
  const saved = prepareLibraryExport([{ source, artifacts }], revisions, new Map(), digests);
  assert.ok(saved.maps.every(map => map.text.length <= MAP_CHARACTER_LIMIT));
  for (const item of saved.items) assert.ok(saved.maps.some(map => map.text.includes(item.id + "  ")));
});

test("repository exports bind first-save origin and exclusions while older imports remain unknown", () => {
  const collections = [{ source, artifacts: [artifact] }];
  const old = prepareLibraryExport(collections, [revision], new Map());
  assert.equal(old.origins, undefined);
  const archive = { format: "study-repository/1" as const, kind: "archive" as const, url: null, commit: null, excluded: ["generated.js", "unchecked.md"] };
  const recorded = { ...revision, import_id: "first-run", repository_origin: archive };
  const saved = prepareLibraryExport(collections, [recorded], new Map());
  assert.equal(saved.items[0].origin_import_id, "first-run");
  assert.deepEqual(saved.origins?.[0].origin.excluded, archive.excluded);
  const text = buildLibraryFiles(saved, [recorded]).map(file => file.text).join("\n");
  assert.ok(text.includes("original repository commit is unknown"));
  assert.ok(text.includes("not a verified current checkout"));
  assert.ok(text.includes(content));
  assert.ok(!text.includes("unchecked.md"));
  assert.match(text, /Excluded paths in this import: 2\./);
  const github = { ...archive, kind: "github" as const, url: "https://github.com/example/project", commit: "a".repeat(40) };
  const pinned = prepareLibraryExport(collections, [{ ...recorded, repository_origin: github }], new Map());
  assert.ok(buildLibraryFiles(pinned, [recorded])[0].text.includes(github.commit));
});

test("new exports use the latest accepted repository paths and keep prior snapshots intact", () => {
  const older = { ...artifact, id: "older", short_code: "F002", path: "old-name.md", current_revision_id: "older-revision" };
  const olderRevision = { ...revision, id: "older-revision", artifact_id: older.id };
  const excluded = { ...artifact, id: "hidden", exclude_from_library: true };
  const latest = new Map([[artifact.id, { path: "renamed.py", revision_id: revision.id }],
    [excluded.id, { path: "hidden.md", revision_id: "hidden-revision" }]]);
  const old = prepareLibraryExport([{ source, artifacts: [artifact, older] }], [revision, olderRevision], new Map());
  const next = prepareLibraryExport([{ source, artifacts: selectLibraryArtifacts([artifact, older, excluded], latest) }], [revision], new Map());
  assert.deepEqual(next.items.map(item => item.path), ["renamed.py"]);
  assert.deepEqual(old.items.map(item => item.path), ["example.py", "old-name.md"]);
  assert.ok(!buildLibraryFiles(next, [revision])[0].text.includes("old-name.md"));
});

test("a newer checkout gets its own snapshot while unchanged files retain their first-save origin", () => {
  const origin = { format: "study-repository/1" as const, kind: "github" as const, url: "https://github.com/example/project",
    commit: "a".repeat(40), excluded: [] };
  const recorded = { ...revision, import_id: "first-run", repository_origin: origin };
  const latestCommit = "b".repeat(40);
  const collections = [{ source, artifacts: [artifact] }];
  const first = prepareLibraryExport([{ ...collections[0], repositoryCommit: origin.commit }], [recorded], new Map());
  const second = prepareLibraryExport([{ ...collections[0], repositoryCommit: latestCommit }], [recorded], new Map());
  assert.notEqual(second.export_id, first.export_id);
  assert.deepEqual(second.items, first.items);
  assert.deepEqual(second.origins, first.origins);
  assert.ok(buildLibraryFiles(second, [recorded])[0].text.includes(`Selected files from imported GitHub commit ${latestCommit}`));
});

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
