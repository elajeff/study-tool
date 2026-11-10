import test from "node:test";
import assert from "node:assert/strict";
import { cleanNotePath, wikiLinks, findLinkedNote } from "../src/lib/notes.ts";

test("note imports reject unsafe paths and non-Markdown files", () => {
  assert.equal(cleanNotePath("../notes.md"), null);
  assert.equal(cleanNotePath(".obsidian/config.md"), null);
  assert.equal(cleanNotePath("Concepts/Arrays.md"), "Concepts/Arrays.md");
  assert.equal(cleanNotePath("Secrets.txt"), null);
});

test("wikilinks find referenced notes, without creating duplicate targets", () => {
  assert.deepEqual(wikiLinks("[[Java]] and [[Java|lang]] then [[Concepts/Arrays#Basics]]"), ["Java", "Concepts/Arrays"]);
  const note = findLinkedNote("Java", [{ path: "Concepts/Java.md" }]);
  assert.equal(note?.path, "Concepts/Java.md");
});
