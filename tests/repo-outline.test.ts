import test from 'node:test';
import assert from 'node:assert/strict';
import { repositoryOutline } from '../src/lib/repo-outline.ts';

test('syntax hints support different languages and leave unsupported text intact', () => {
  for (const [path, text, expected] of [
    ['tools/convert.py', 'class Converter:\n    def run(self):\n        return 1', /def run/],
    ['ui/main.ts', 'export function convert(x: number) { return x; }', /function convert/],
    ['src/Thing.java', 'public record Thing(int id) {}', /record Thing/],
    ['schema.sql', 'CREATE TABLE measurements (value int);', /CREATE TABLE/],
    ['notes.md', '# Unrelated topic\nOriginal explanation.', /Unrelated topic/],
    ['package.json', '{"dependencies":{"some-library":"1"}}', /some-library/],
  ] as const) {
    const result = repositoryOutline(path, text);
    assert.ok(result.supported);
    assert.match(result.lines.join('\n'), expected);
    assert.equal(result.warning, null);
  }
  assert.equal(repositoryOutline('package.json', '{invalid').warning, 'This manifest is not valid JSON.');
  assert.equal(repositoryOutline('code.rs', 'fn main() {}').supported, false);
  assert.equal(repositoryOutline('many.py', Array.from({ length: 35 }, (_, n) => `def f${n}(): pass`).join('\n')).truncated, true);
});

