import test from "node:test";
import assert from "node:assert/strict";
import { buildCurriculum, nextLesson } from "../src/lib/curriculum.ts";

const profile = { experience: "Basic Java", goals: "Build a backend project", focus: "Java", hours_per_week: 6 };
const vault = [
  { path: "Concepts/Java.md", title: "Java", body: "# Java\n\nProgramming language.\n\n## Required foundations\nNone" },
  { path: "Concepts/Spring Boot.md", title: "Spring Boot", body: "# Spring Boot\n\nBackend framework.\n\n## Required foundations\n[[Concepts/Java|Java]]\n\n## Recommended preparation\n[[Concepts/Database|Database]]" },
  { path: "Concepts/Database.md", title: "Database", body: "# Database\n\nOrganized data storage." },
  { path: "Learning Paths/01 Backend.md", title: "01 Backend", body: "# Backend\n\n1. [[Concepts/Java]]\n2. [[Concepts/Spring Boot]]" },
];

test("roadmap is based on imported notes, not fixed global lessons", () => {
  assert.equal(buildCurriculum([], profile).lessons.length, 0);
  const { lessons, tracks } = buildCurriculum(vault, profile);
  assert.equal(lessons.length, 3);
  assert.ok(tracks.some((t) => t.title === "Backend"));
  const java = lessons.find((l) => l.title === "Java")!;
  const spring = lessons.find((l) => l.title === "Spring Boot")!;
  assert.deepEqual(spring.prerequisites, [java.id]);
  assert.ok(spring.recommendations.length === 1);
  assert.ok(nextLesson(lessons, new Set([java.id])));
});

test("different vaults yield different lessons and stable IDs", () => {
  const one = buildCurriculum(vault, profile).lessons;
  const two = buildCurriculum([{ path: "My topic.md", title: "My topic", body: "# My topic\n\nA topic." }], profile).lessons;
  assert.equal(two.length, 1);
  assert.notEqual(one[0].id, two[0].id);
  assert.deepEqual(one.map((l) => l.id), buildCurriculum(vault, profile).lessons.map((l) => l.id));
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
