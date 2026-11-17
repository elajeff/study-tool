import test from "node:test";
import assert from "node:assert/strict";
import { repositoryDraftPrompt } from "../src/lib/portfolio.ts";

test("repository draft requests retain the selected snapshot and repository scope", () => {
  const prompt = repositoryDraftPrompt("Xsaved", { id: "one", short_code: "R1", kind: "repository", name: 'One "quoted" repository' });
  assert.match(prompt, /export_id Xsaved/);
  assert.match(prompt, /scoped to R1/);
  assert.ok(prompt.includes(JSON.stringify('One "quoted" repository')));
  assert.match(prompt, /not a verified complete curriculum/);
});
