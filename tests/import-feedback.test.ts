import test from 'node:test';
import assert from 'node:assert/strict';
import { readImportFiles } from '../src/lib/import-files.ts';

test('archive errors identify the selected file without accepting a partial import', async () => {
  await assert.rejects(readImportFiles([new File(['broken'], 'damaged.zip')], () => true), /damaged.zip:/);
});
