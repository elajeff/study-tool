import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { readImportFiles } from '../src/lib/import-files.ts';

test('archive errors identify the selected file without accepting a partial import', async () => {
  await assert.rejects(readImportFiles([new File(['broken'], 'damaged.zip')], () => true), /damaged.zip:/);
});

test('invalid UTF-8 identifies the affected loose or archived file', async () => {
  const bytes = Uint8Array.of(0xc3);
  const zip = new JSZip();
  zip.file('broken.md', bytes);
  for (const file of [
    new File([bytes], 'broken.md'),
    new File([await zip.generateAsync({ type: 'arraybuffer' })], 'vault.zip'),
  ]) {
    await assert.rejects(readImportFiles([file], () => true), /broken\.md is not valid UTF-8/);
  }
});
