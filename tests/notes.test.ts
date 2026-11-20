import test from "node:test";
import assert from "node:assert/strict";
import { cleanNotePath, noteRelationships, resolveNoteLink, type SourceAlias } from "../src/lib/notes.ts";

test("note imports reject unsafe paths and non-Markdown files", () => {
  assert.equal(cleanNotePath("../notes.md"), null);
  assert.equal(cleanNotePath(".obsidian/config.md"), null);
  assert.equal(cleanNotePath("Concepts/Arrays.md"), "Concepts/Arrays.md");
  assert.equal(cleanNotePath("Secrets.txt"), null);
});

test("wikilinks resolve a note by its path", () => {
  const result = resolveNoteLink("Java", [{ path: "Concepts/Java.md" }]);
  assert.equal(result.state === "resolved" && result.note.path, "Concepts/Java.md");
});

test("the ChatBridge archive is excluded while ordinary folders are accepted", async () => {
  const { shouldImportNote } = await import("../src/lib/notes.ts");
  assert.equal(shouldImportNote("AI Chats/conversation.md"), false);
  assert.equal(shouldImportNote("Vault/AI Chats/conversation.md"), false);
  assert.equal(shouldImportNote("Progress/Dashboard.md"), true);
  assert.equal(shouldImportNote("Tools/README.md"), true);
  assert.equal(shouldImportNote("Lessons/Java/06 Methods.md"), true);
});

test("multiple marked vaults must be imported separately", async () => {
  const { vaultRoot } = await import("../src/lib/notes.ts");
  assert.throws(() => vaultRoot(["First/.obsidian", "Second/.obsidian"]), /multiple Obsidian vaults/);
});

test("relationships retain kind and line references while ignoring code and attachment examples", () => {
  const body = ["# Topic", "[[Overview|start]]", "## Prerequisites", "[[Basics#Methods]]", "### Practice", "[[Values]]",
    "## Recommended background", "[[Optional]]", "## Notes", "`[[Code]]` and ![[photo.png]]", "~~~md", "## Prerequisites", "[[Not required]]", "~~~still code", "[[Still code]]", "~~~"].join("\r\n");
  assert.deepEqual(noteRelationships(body), [
    { target: "Overview", kind: "link", line: 2, heading: "Topic" },
    { target: "Basics", kind: "prerequisite", line: 4, heading: "Prerequisites" },
    { target: "Values", kind: "prerequisite", line: 6, heading: "Practice" },
    { target: "Optional", kind: "recommendation", line: 8, heading: "Recommended background" },
  ]);
});

test("accepted path history retains renamed targets but never guesses after path reuse or deletion", () => {
  const note = { path: "New.md", artifact_id: "same-file" };
  const alias: SourceAlias = { source_id: "vault", artifact_id: note.artifact_id, path: "Old.md", current_path: note.path, current_revision_id: "revision" };
  assert.deepEqual(resolveNoteLink("Old", [note], [alias]), { state: "resolved", note });
  assert.deepEqual(resolveNoteLink("Old", [note, { path: "Old.md", artifact_id: "other-file" }], [alias]), { state: "ambiguous" });
  assert.deepEqual(resolveNoteLink("Old", [], [alias]), { state: "missing" });
  assert.deepEqual(resolveNoteLink("Absent", [note], [alias]), { state: "missing" });
});
