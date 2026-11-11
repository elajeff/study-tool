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

test("generated vault data and chat transcripts are excluded from import", async () => {
  const { shouldImportNote } = await import("../src/lib/notes.ts");
  assert.equal(shouldImportNote("AI Chats/conversation.md"), false);
  assert.equal(shouldImportNote("Progress/Dashboard.md"), false);
  assert.equal(shouldImportNote("Tools/README.md"), false);
  assert.equal(shouldImportNote("Lessons/Java/06 Methods.md"), true);
});

test("vault ZIPs can have one surrounding directory without losing their note paths", async () => {
  const { vaultRoot } = await import("../src/lib/notes.ts");
  assert.equal(vaultRoot(["nothingburger/Concepts/Java.md", "nothingburger/AI Chats/log.md"]), "nothingburger");
  assert.equal(vaultRoot(["Concepts/Java.md", "DSA/Arrays.md"]), null);
  assert.equal(vaultRoot(["Notes/Java.md", "Notes/C.md"]), null);
});
