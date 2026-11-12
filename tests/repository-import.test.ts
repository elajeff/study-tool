import test from "node:test";
import assert from "node:assert/strict";
import JSZip from "jszip";
import { readImportFiles } from "../src/lib/import-files.ts";
import { shouldImportRepositoryFile, inspectRepositoryText, previewRepository } from "../src/lib/repository-import.ts";

test("repository ZIPs retain relative paths and text while excluding secrets, generated files, and unsafe paths", async () => {
  const zip = new JSZip();
  const paths = ["src/Main.java", "ui/App.tsx", "tools/task.js", "scripts/main.py", "db/schema.sql", ".github/workflows/ci.yml", "package.json", "README.md"];
  for (const path of paths) zip.file(path, "// Synthetic π\r\n");
  const excluded = [".env", "config/.env.local", "config/private.pem", "node_modules/a/index.js", "target/Main.java", ".git/config", "package-lock.json", "../escape.py", "/absolute.sql", "C:/drive.sql"];
  for (const path of excluded) zip.file(path, "Excluded");
  const result = await readImportFiles([new File([await zip.generateAsync({ type: "uint8array" })], "repository.zip")], shouldImportRepositoryFile);
  assert.deepEqual(result.files.map((file) => file.path), paths);
  assert.equal(result.files[0].body, "// Synthetic π\r\n");
  assert.equal(result.skipped.length, excluded.length);
});

test("credential checks block private keys and known tokens and flag uncertain assignments for explicit review", () => {
  for (const body of ["-----BEGIN PRIVATE KEY-----", ["ghp_", "a".repeat(36)].join("")]) assert.ok(inspectRepositoryText(body).blocked);
  for (const body of ['password: "abc"', "password: example-value", '{"apiKey":"example-value"}', 'const secret = "placeholder-value";', 'url: "postgres://example:example@localhost/db"']) {
    const result = inspectRepositoryText(body);
    assert.equal(result.blocked, null); assert.ok(result.review);
  }
  for (const body of ["class Main {}", "const apiKey = process.env.API_KEY;", 'secret: "${SECRET_VALUE}"'])
    assert.deepEqual(inspectRepositoryText(body), { blocked: null, review: null });
});

test("repository previews distinguish new, updated, unchanged, and conflicting paths without inferring renames", () => {
  const saved = { artifact_id: "file-a", path: "src/Main.java", revision_id: "revision-a", content_hash: "old" };
  for (const [path, hash, status] of [[saved.path, "old", "Unchanged"], [saved.path, "new", "Updated"], ["src/New.java", "old", "New"], ["src/main.java", "old", "Conflict"]])
    assert.equal(previewRepository([{ path, hash, body: "text" }], [saved])[0].status, status);
  assert.equal(previewRepository([{ path: "src/New.java", hash: "old", body: "text" }], [saved], { "src/New.java": saved.artifact_id })[0].previous?.artifact_id, saved.artifact_id);
});
