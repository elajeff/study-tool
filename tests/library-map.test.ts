import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLibraryMaps, MAP_CHARACTER_LIMIT } from '../src/lib/library-map.ts';
import type { LibraryArtifact } from '../src/lib/library-queries.ts';

const source = { id: 'source-a', short_code: 'R7', kind: 'repository', name: 'Synthetic collection' };
const file = (n: number, path: string): LibraryArtifact => ({
  id: `artifact-${n}`, short_code: `F${String(n).padStart(3, '0')}`, path,
  external_id: null, current_revision_id: `revision-${n}`,
});

test('large directories and many folders stay bounded, reachable and complete', () => {
  const files = Array.from({ length: 1500 }, (_, n) => file(n + 1, `large/file-${n}.txt`));
  files.push(...Array.from({ length: 500 }, (_, n) => file(n + 1501, `folder-${n}/file.txt`)));
  const maps = buildLibraryMaps(source, files);
  const byId = new Map(maps.map((map) => [map.id, map]));
  const visited = new Set<string>();
  const found = new Set<string>();
  function visit(id: string) {
    if (visited.has(id)) return;
    visited.add(id);
    const map = byId.get(id);
    assert.ok(map, `Missing map ${id}`);
    assert.ok(map.text.length <= MAP_CHARACTER_LIMIT, map.id);
    for (const entry of map.entries) {
      if (entry.artifact) {
        assert.ok(!found.has(entry.artifact.id), 'An artifact appears twice');
        found.add(entry.artifact.id);
      } else visit(entry.id);
    }
    if (map.next) visit(map.next);
  }
  visit(maps[0].id);
  assert.equal(found.size, files.length);
  assert.equal(visited.size, maps.length);
  assert.ok(maps[0].text.length < MAP_CHARACTER_LIMIT);
});

test('maps keep artifact identity across edits, renames and additions without altering source metadata', () => {
  const original = file(8, 'old/name.py');
  const renamed = { ...original, path: 'new/name.py', current_revision_id: 'revision-new' };
  for (const files of [[original], [file(9, 'aaa.txt'), renamed]]) {
    const maps = buildLibraryMaps(source, files);
    assert.equal(maps.flatMap((map) => map.entries).find((entry) => entry.artifact?.id === original.id)?.id, 'R7/F008');
    assert.match(maps[0].text, /may span imports/);
    assert.match(maps[0].text, /omissions are unknown/);
  }
  const long = file(10, 'nested/' + '<script>\n'.repeat(1000));
  const map = buildLibraryMaps(source, [long]).at(-1)!;
  assert.ok(map.text.length <= MAP_CHARACTER_LIMIT);
  assert.match(map.text, /label shortened/);
  assert.equal(map.entries[0].artifact?.path, long.path);
  assert.equal(original.path, 'old/name.py');
  const roots = buildLibraryMaps(source, [file(11, 'root.txt'), file(12, '(root)/nested.txt')])[0];
  assert.equal(roots.entries.length, 2, 'A literal directory name must not collide with the root group');
  assert.equal(buildLibraryMaps(source, [])[0].entries.length, 0);
});


