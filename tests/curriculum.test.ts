import test from "node:test";
import assert from "node:assert/strict";
import { buildCurriculum, nextLesson } from "../src/lib/curriculum.ts";
import { latestApproved, progressStats, type Assessment } from "../src/lib/progress.ts";

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
  assert.equal(lessons.length, 4);
  assert.ok(lessons.some((lesson) => lesson.sourcePath === "My course/Transactions.md"));
  assert.ok(tracks.some((t) => t.title === "Backend"));
  const java = lessons.find((l) => l.title === "Java")!;
  const spring = lessons.find((l) => l.title === "Spring Boot")!;
  assert.deepEqual(spring.prerequisites, [java.id]);
  assert.ok(spring.recommendations.length === 1);
  assert.ok(nextLesson(lessons, new Set([java.id])));
});

test("Obsidian Java, DSA, foundations, projects, concepts and walkthroughs remain separate", () => {
  const notes = [
    { path: "Lessons/Java/05 Loops.md", title: "Loops", body: "# Loops\n\nRepeat code." },
    { path: "Lessons/Java/06 Methods.md", title: "Methods", body: "# Methods\n\nMethods return values.\n\n## Before you start\n[[Lessons/Java/05 Loops|Loops]]" },
    { path: "DSA/04 Sliding window.md", title: "Sliding window", body: "# Sliding window\n\n## Preparation\n[[Lessons/Java/06 Methods|Methods]]" },
    { path: "Foundations/03 HTTP and JSON.md", title: "HTTP", body: "# HTTP\n\nA request and response." },
    { path: "Learning Projects/Request Tracker.md", title: "Request Tracker", body: "# Request Tracker\n\nWrite a service." },
    { path: "Concepts/Java.md", title: "Java", body: "# Java\n\nA language." },
    { path: "Walkthroughs/Request flow.md", title: "Request flow", body: "# Request flow\n\nTrace code." },
    { path: "Progress/Dashboard.md", title: "Dashboard", body: "# Dashboard\n\nIgnored." },
    { path: "AI Chats/transcript.md", title: "Chat", body: "# Chat\n\nIgnored." },
    { path: "Learning Paths/00 Start here.md", title: "Map", body: "# Map\n\nIgnored." },
  ];
  const { lessons, tracks } = buildCurriculum(notes, profile);
  assert.equal(lessons.length, 7);
  assert.deepEqual(tracks.map((t) => t.title), ["Java", "Algorithms", "Foundations", "Projects", "Concepts", "Walkthroughs"]);
  const loops = lessons.find((l) => l.title === "Loops")!;
  const methods = lessons.find((l) => l.title === "Methods")!;
  const sliding = lessons.find((l) => l.title === "Sliding window")!;
  assert.deepEqual(methods.prerequisites, [loops.id]);
  assert.deepEqual(sliding.prerequisites, []);
  assert.deepEqual(sliding.recommendations, [methods.id]);
});

test("source conflicts and cycles are reported without recommending an invalid starting topic", () => {
  const note = (path: string, body = "") => ({ path, title: path, body });
  const conflict = buildCurriculum([note("Topic.md"), note("topic.md")], profile);
  assert.match(conflict.issues.join(" "), /Topic.md.*topic.md/);
  assert.equal(nextLesson(conflict.lessons, new Set()), undefined);
  const cycle = buildCurriculum([
    note("A.md", "## Prerequisites\n[[B]]"),
    note("B.md", "## Prerequisites\n[[A]]"),
  ], profile);
  assert.match(cycle.issues.join(" "), /Circular prerequisites/);
  assert.equal(cycle.lessons.reduce((count, lesson) => count + lesson.prerequisites.length, 0), 2);
  assert.equal(nextLesson(cycle.lessons, new Set()), undefined);
});

test("same paths in separate vaults keep separate topics and prerequisites; renames retain approved progress", () => {
  const notes = ["vault-a", "vault-b"].flatMap((source_id) => [
    { path: "Basics.md", title: "Basics", body: "# Basics", source_id, topic: `source/${source_id}-basics` },
    { path: "Next.md", title: "Next", body: "## Prerequisites\n[[Basics]]", source_id, topic: `source/${source_id}-next` },
  ]);
  const { lessons, issues } = buildCurriculum(notes, profile);
  assert.deepEqual(issues, []);
  assert.equal(new Set(lessons.map((lesson) => lesson.id)).size, 4);
  assert.deepEqual(lessons.map((lesson) => lesson.id), buildCurriculum(notes, profile).lessons.map((lesson) => lesson.id));
  const unrelated = latestApproved([{ id: "old", topic: "Basics", status: "approved", date: "2026-11-12", level: 3, reviewed_at: "2026-11-12" } as Assessment]);
  assert.equal(progressStats(lessons, unrelated).assessed, 0);
  for (const vault of ["vault-a", "vault-b"]) {
    assert.deepEqual(lessons.find((lesson) => lesson.topic === `source/${vault}-next`)?.prerequisites,
      [lessons.find((lesson) => lesson.topic === `source/${vault}-basics`)!.id]);
  }
  const original = { path: "Lessons/Java/Methods.md", title: "Methods", body: "# Methods" };
  const before = buildCurriculum([original], profile).lessons[0];
  const renamed = buildCurriculum([{ ...original, path: "Lessons/Java/Renamed.md", topic: "Lessons/Java/Methods", source_id: "legacy" }], profile).lessons[0];
  assert.equal(renamed.id, before.id);
  assert.equal(renamed.topic, before.topic);
  const latest = latestApproved([{ id: "approved", topic: before.topic, status: "approved", date: "2026-11-12", level: 3, reviewed_at: "2026-11-12" } as Assessment]);
  assert.deepEqual(progressStats([renamed], latest), { assessed: 1, demonstrated: 1, total: 1 });
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
  assert.equal(nextLesson([advanced], new Set()), undefined);
});

test("only explicit prerequisites block study, and renamed targets stay scoped while content changes take effect", () => {
  const base = { path: "Renamed.md", title: "Basics", body: "# Basics", source_id: "vault-a", artifact_id: "base-a", topic: "source/base-a" };
  const next = { path: "Next.md", title: "Next", body: "[[Missing ordinary link]]\n## Prerequisites\n[[Basics]]\n## Related study material\n[[Optional]]", source_id: "vault-a", artifact_id: "next-a", topic: "source/next-a" };
  const notes = [base, next, { path: "Basics.md", title: "Other vault", body: "# Other", source_id: "vault-b", artifact_id: "base-b", topic: "source/base-b" },
    { path: "Optional.md", title: "Optional", body: "# Optional", source_id: "vault-a", artifact_id: "optional" }];
  const aliases = [{ source_id: "vault-a", artifact_id: "base-a", path: "Basics.md", current_path: "Renamed.md", current_revision_id: "revision" }];
  const current = buildCurriculum(notes, profile, aliases);
  const lesson = current.lessons.find((lesson) => lesson.topic === next.topic)!;
  assert.equal(lesson.blocked, false);
  assert.deepEqual(lesson.prerequisites, [current.lessons.find((lesson) => lesson.topic === base.topic)!.id]);
  assert.equal(lesson.recommendations.length, 1);
  assert.deepEqual(current.issues, []);
  const changed = buildCurriculum(notes.map((note) => note === next ? { ...note, body: "[[Optional]]" } : note), profile, aliases);
  assert.deepEqual(changed.lessons.find((candidate) => candidate.id === lesson.id)?.prerequisites, []);
  const reused = buildCurriculum([...notes, { ...base, path: "Basics.md", artifact_id: "new-file", topic: "source/new-file" }], profile, aliases);
  assert.equal(reused.lessons.find((candidate) => candidate.id === lesson.id)?.blocked, true);
});
