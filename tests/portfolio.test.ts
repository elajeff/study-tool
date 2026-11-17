import test from "node:test";
import assert from "node:assert/strict";
import { repositoryDraftPrompt, repositoryDraftSource, portfolioMergePrompt } from "../src/lib/portfolio.ts";
import type { Course } from "../src/lib/course.ts";

test("repository draft requests retain the selected snapshot and repository scope", () => {
  const prompt = repositoryDraftPrompt("Xsaved", { id: "one", short_code: "R1", kind: "repository", name: 'One "quoted" repository' });
  assert.match(prompt, /export_id Xsaved/);
  assert.match(prompt, /scoped to R1/);
  assert.ok(prompt.includes(JSON.stringify('One "quoted" repository')));
  assert.match(prompt, /not a verified complete curriculum/);
});
const repositories = [
  { id: "one", short_code: "R1", kind: "repository", name: "One" },
  { id: "two", short_code: "R2", kind: "repository", name: "Two" },
];
const course = (source: string): Course => ({
  format: "study-course/1", export_id: "export", title: source, goal: "Rebuild", target: "Independent", assumed_level: "Beginner",
  modules: [{ id: "M01", title: "Foundation", outcome: "Explain", proof: "Explain alone", needs: [], sources: [source], steps_estimate: 3 }],
  not_covered: [], open_questions: [],
});

test("portfolio merge keeps exact source versions and namespaces draft module IDs", () => {
  const drafts = [{ id: "draft1", course: course("R1/F001") }, { id: "draft2", course: course("R2/F001") }];
  drafts[0].course.modules.push({ ...drafts[0].course.modules[0], id: "M02", needs: ["M01"] });
  drafts[0].course.not_covered.push({ id: "R1/F002", why: "Fixture subsystem not inspected" });
  drafts[0].course.open_questions.push("Fixture prerequisite is uncertain");
  const prompt = portfolioMergePrompt("export", repositories, drafts);
  assert.match(prompt, /R1\/M01/);
  assert.match(prompt, /R2\/M01/);
  const reference = JSON.parse(prompt.split("REFERENCE DATA (JSON):\n")[1]);
  assert.deepEqual(reference.drafts[0].modules[1].needs, ["R1/M01"]);
  assert.deepEqual(reference.drafts[0].modules[0].sources, ["R1/F001"]);
  assert.match(prompt, /shared foundations once/);
  assert.match(prompt, /Fixture subsystem not inspected/);
  assert.match(prompt, /Fixture prerequisite is uncertain/);
  assert.match(repositoryDraftPrompt("export", repositories[0]), /scoped to R1/);
  assert.throws(() => portfolioMergePrompt("other", repositories, drafts), /same exact/);
  assert.throws(() => portfolioMergePrompt("export", repositories, [drafts[0]]), /every repository/);
  assert.throws(() => portfolioMergePrompt("export", repositories, [drafts[0], drafts[0]]), /exactly one/);
  const mixed = course("R1/F001");
  mixed.modules[0].sources.push("R2/F001");
  assert.equal(repositoryDraftSource(repositories, mixed), null);
  assert.equal(repositoryDraftSource(repositories, course("general")), null);
  drafts[0].course.goal = "x".repeat(200000);
  assert.throws(() => portfolioMergePrompt("export", repositories, drafts), /merge-card limit/);
});
