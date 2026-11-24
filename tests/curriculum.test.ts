import test from "node:test";
import assert from "node:assert/strict";
import { buildCurriculum } from "../src/lib/curriculum.ts";

const profile = { experience: "Basic Java", goals: "Build a backend project", focus: "Java", hours_per_week: 6 };
const vault = [
  { path: "Concepts/Java.md", title: "Java", body: "# Java\n\nProgramming language.\n\n## Required foundations\nNone" },
  { path: "Concepts/Spring Boot.md", title: "Spring Boot", body: "# Spring Boot\n\nBackend framework.\n\n## Required foundations\n[[Concepts/Java|Java]]\n\n## Recommended preparation\n[[Concepts/Database|Database]]" },
  { path: "Concepts/Database.md", title: "Database", body: "# Database\n\nOrganized data storage." },
  { path: "My course/Transactions.md", title: "Transactions", body: "# Transactions" },
  { path: "Learning Paths/01 Backend.md", title: "01 Backend", body: "# Backend\n\n1. [[Concepts/Java]]\n2. [[Concepts/Spring Boot]]" },
];

test("roadmap is based on imported notes, not fixed global lessons", () => {
  assert.equal(buildCurriculum([], profile).lessons.length, 0);
  const { lessons, tracks } = buildCurriculum(vault, profile);
  assert.equal(lessons.length, vault.length);
  assert.ok(lessons.some((lesson) => lesson.sourcePath === "My course/Transactions.md"));
  assert.ok(tracks.some((t) => t.title === "Learning Paths"));
  const java = lessons.find((l) => l.title === "Java")!;
  const spring = lessons.find((l) => l.title === "Spring Boot")!;
  assert.deepEqual(spring.prerequisites, [java.id]);
  assert.ok(spring.recommendations.length === 1);
});

test("ordinary note names and folders work across different subjects", () => {
  const notes = ["Biology/Testing.md", "Projects/Journal.md", "README.md", "Research/Home.md"]
    .map(path => ({ path, title: path, body: "A note" }));
  const { lessons, tracks } = buildCurriculum(notes, profile);
  assert.deepEqual(lessons.map(lesson => lesson.sourcePath).sort(), notes.map(note => note.path).sort());
  assert.deepEqual(tracks.map(track => track.title).sort(), ["Biology", "Notes", "Projects", "Research"]);
});

test("source conflicts and cycles are reported", () => {
  const note = (path: string, body = "") => ({ path, title: path, body });
  const conflict = buildCurriculum([note("Topic.md"), note("topic.md")], profile);
  assert.match(conflict.issues.join(" "), /Topic.md.*topic.md/);
  const cycle = buildCurriculum([
    note("A.md", "## Prerequisites\n[[B]]"),
    note("B.md", "## Prerequisites\n[[A]]"),
  ], profile);
  assert.match(cycle.issues.join(" "), /Circular prerequisites/);
  assert.equal(cycle.lessons.reduce((count, lesson) => count + lesson.prerequisites.length, 0), 2);
});

test("same paths in separate vaults keep separate topics and prerequisites; renames keep the same topic ID", () => {
  const notes = ["vault-a", "vault-b"].flatMap((source_id) => [
    { path: "Basics.md", title: "Basics", body: "# Basics", source_id, source_name: source_id, topic: `source/${source_id}-basics` },
    { path: "Next.md", title: "Next", body: "## Prerequisites\n[[Basics]]", source_id, source_name: source_id, topic: `source/${source_id}-next` },
  ]);
  const { lessons, issues } = buildCurriculum(notes, profile);
  assert.deepEqual(issues, []);
  assert.equal(new Set(lessons.map((lesson) => lesson.id)).size, 4);
  assert.deepEqual(lessons.map((lesson) => lesson.id), buildCurriculum(notes, profile).lessons.map((lesson) => lesson.id));
  for (const vault of ["vault-a", "vault-b"]) {
    assert.deepEqual(lessons.find((lesson) => lesson.sourceName === vault && lesson.sourcePath === "Next.md")?.prerequisites,
      [lessons.find((lesson) => lesson.sourceName === vault && lesson.sourcePath === "Basics.md")!.id]);
  }
  const original = { path: "Lessons/Java/Methods.md", title: "Methods", body: "# Methods" };
  const before = buildCurriculum([original], profile).lessons[0];
  const renamed = buildCurriculum([{ ...original, path: "Lessons/Java/Renamed.md", topic: "Lessons/Java/Methods", source_id: "legacy" }], profile).lessons[0];
  assert.equal(renamed.id, before.id);
});

test("ambiguous prerequisite names are reported rather than linked to an arbitrary note", () => {
  const result = buildCurriculum([
    { path: "A/Basics.md", title: "A", body: "# A" },
    { path: "B/Basics.md", title: "B", body: "# B" },
    { path: "Advanced.md", title: "Advanced", body: "## Prerequisites\n[[Basics]]" },
  ], profile);
  const advanced = result.lessons.find((lesson) => lesson.title === "Advanced")!;
  assert.equal(advanced.blocked, true);
  assert.deepEqual(advanced.prerequisites, []);
  assert.match(result.issues.join(" "), /ambiguous link/);
});

test("only explicit prerequisites block study, and renamed targets stay scoped while content changes take effect", () => {
  const base = { path: "Renamed.md", title: "Basics", body: "# Basics", source_id: "vault-a", artifact_id: "base-a", topic: "source/base-a" };
  const next = { path: "Next.md", title: "Next", body: "[[Missing ordinary link]]\n## Prerequisites\n[[Basics]]\n## Related study material\n[[Optional]]", source_id: "vault-a", artifact_id: "next-a", topic: "source/next-a" };
  const notes = [base, next, { path: "Basics.md", title: "Other vault", body: "# Other", source_id: "vault-b", artifact_id: "base-b", topic: "source/base-b" },
    { path: "Optional.md", title: "Optional", body: "# Optional", source_id: "vault-a", artifact_id: "optional" }];
  const aliases = [{ source_id: "vault-a", artifact_id: "base-a", path: "Basics.md", current_path: "Renamed.md", current_revision_id: "revision" }];
  const current = buildCurriculum(notes, profile, aliases);
  const lesson = current.lessons.find((lesson) => lesson.sourcePath === next.path)!;
  assert.equal(lesson.blocked, false);
  assert.deepEqual(lesson.prerequisites, [current.lessons.find((lesson) => lesson.sourcePath === base.path)!.id]);
  assert.equal(lesson.recommendations.length, 1);
  assert.deepEqual(current.issues, []);
  const changed = buildCurriculum(notes.map((note) => note === next ? { ...note, body: "[[Optional]]" } : note), profile, aliases);
  assert.deepEqual(changed.lessons.find((candidate) => candidate.id === lesson.id)?.prerequisites, []);
  const reused = buildCurriculum([...notes, { ...base, path: "Basics.md", artifact_id: "new-file", topic: "source/new-file" }], profile, aliases);
  assert.equal(reused.lessons.find((candidate) => candidate.id === lesson.id)?.blocked, true);
});
