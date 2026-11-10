import { createHash } from "node:crypto";
import { findLinkedNote, wikiLinks } from "./notes.ts";

export type StudyProfile = {
  experience: string;
  goals: string;
  focus: string;
  hours_per_week: number;
};

export type SourceNote = { path: string; title: string; body: string };
export type Track = { id: string; title: string; description: string };
export type Lesson = {
  id: string;
  track: string;
  title: string;
  prerequisites: string[];
  recommendations: string[];
  summary: string;
  explanation: string;
  example: string;
  exercise: string;
  completion: string;
  sourcePath: string;
  sourceBody: string;
};

const titleFromPath = (path: string) => path.split("/").at(-1)?.replace(/\.md$/i, "") ?? path;
const sourceId = (path: string) => `note-${createHash("sha256").update(path.toLowerCase()).digest("hex").slice(0, 20)}`;

function section(body: string, name: RegExp) {
  const lines = body.split(/\r?\n/);
  const index = lines.findIndex((line) => /^##\s+/.test(line) && name.test(line.slice(3).trim()));
  if (index === -1) return "";
  const end = lines.findIndex((line, i) => i > index && /^#{1,2}\s+/.test(line));
  return lines.slice(index + 1, end === -1 ? undefined : end).join("\n").trim();
}

function summary(body: string) {
  const paragraphs = body.replace(/^# [^\n]+\n/, "").split(/\n\s*\n/);
  return paragraphs.find((part) => part.trim() && !part.trim().startsWith("#"))?.trim().replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, "$2$1").slice(0, 350) ?? "Open the source note to explore this topic.";
}

function goalWords(profile: StudyProfile) {
  return new Set(`${profile.goals} ${profile.focus}`.toLowerCase().match(/[a-z][a-z0-9+#-]{2,}/g) ?? []);
}

function studyPriority(label: string, profile: StudyProfile) {
  const text = label.toLowerCase();
  const words = goalWords(profile);
  let score = 0;
  for (const word of words) if (text.includes(word)) score += 5;
  if (profile.experience.toLowerCase().includes("java") && text.includes("java")) score += 8;
  return score;
}

/** Build an editable study sequence from each person's imported notes, never a global preset. */
export function buildCurriculum(allNotes: SourceNote[], profile: StudyProfile | null): { tracks: Track[]; lessons: Lesson[] } {
  if (!profile) return { tracks: [], lessons: [] };
  const notes = allNotes.filter((note) => note.path.toLowerCase().endsWith(".md"));
  const concepts = notes.filter((note) => /^concepts\//i.test(note.path));
  // Obsidian vaults may use their own folder names. When no Concepts folder exists,
  // use ordinary notes, excluding indexes, transcripts and generated source inventories.
  const candidates = concepts.length ? concepts : notes.filter((note) =>
    !/^(ai chats|research|maps|learning paths)\//i.test(note.path)
    && !/(source index|source audit|manifest|home)\.md$/i.test(note.path)
    && !/\/testing\.md$/i.test(note.path));
  const outlines = notes.filter((note) => /^learning paths\//i.test(note.path));
  const trackMap = new Map<string, Track>();
  const outlineTrack = new Map<string, string>();
  const outlineRank = new Map<string, number>();
  for (const outline of outlines.sort((a, b) => a.path.localeCompare(b.path))) {
    const links = wikiLinks(outline.body);
    const trackId = sourceId(outline.path);
    let count = 0;
    for (const link of links) {
      const found = findLinkedNote(link, candidates);
      if (found && !outlineTrack.has(found.path)) {
        outlineTrack.set(found.path, trackId);
        outlineRank.set(found.path, count++);
      }
    }
    if (count) trackMap.set(trackId, {
      id: trackId,
      title: titleFromPath(outline.path).replace(/^\d+\s*/, ""),
      description: `Topics linked from ${outline.path}`,
    });
  }
  const otherTrackId = "other-topics";
  if (candidates.some((note) => !outlineTrack.has(note.path))) trackMap.set(otherTrackId, {
    id: otherTrackId, title: concepts.length ? "Other concepts" : "Your notes", description: "Topics from your imported knowledge base",
  });
  const raw = candidates.map((note) => {
    const required = section(note.body, /^(required foundations|required prerequisites|prerequisites)$/i);
    const recommended = section(note.body, /^recommended (preparation|background|reading)$/i);
    const prerequisites = wikiLinks(required).map((link) => findLinkedNote(link, candidates)?.path).filter((p): p is string => !!p && p !== note.path);
    const recommendations = wikiLinks(recommended).map((link) => findLinkedNote(link, candidates)?.path).filter((p): p is string => !!p && p !== note.path);
    const code = note.body.match(/```[^\n]*\n([\s\S]*?)\n```/);
    const questions = section(note.body, /^(what you should be able to explain|practice|exercises?)$/i);
    const firstQuestion = questions.split("\n").map((s) => s.replace(/^[-*\d.)\s]+/, "").trim()).find(Boolean);
    return {
      id: sourceId(note.path), track: outlineTrack.get(note.path) ?? otherTrackId,
      title: note.title || titleFromPath(note.path), sourcePath: note.path, sourceBody: note.body,
      prerequisites: [...new Set(prerequisites)], recommendations: [...new Set(recommendations)],
      summary: summary(note.body), explanation: summary(note.body), example: code?.[1] ?? "",
      exercise: firstQuestion || `Explain ${note.title || titleFromPath(note.path)} in your own words and apply it to an example.`,
      completion: "Demonstrate understanding with an independently completed explanation or exercise; record evidence before marking complete.",
    };
  });
  const bySourcePath = new Map(raw.map((lesson) => [lesson.sourcePath, lesson]));
  const all = raw.map((lesson) => ({    
...lesson,
    prerequisites: lesson.prerequisites.map((p) => bySourcePath.get(p)?.id).filter((x): x is string => !!x),
    recommendations: lesson.recommendations.map((p) => bySourcePath.get(p)?.id).filter((x): x is string => !!x),
  }));
  const byId = new Map(all.map((lesson) => [lesson.id, lesson]));
  const visited = new Set<string>();
  const active = new Set<string>();
  const sorted: Lesson[] = [];
  const preference = (a: Lesson, b: Lesson) =>
    studyPriority(b.title, profile) - studyPriority(a.title, profile) ||
    (outlineRank.get(a.sourcePath) ?? 999) - (outlineRank.get(b.sourcePath) ?? 999) ||
    a.title.localeCompare(b.title);
  function visit(lesson: Lesson) {
    if (visited.has(lesson.id)) return;
    if (active.has(lesson.id)) return; // Skip a circular prerequisite instead of recursing indefinitely.
    active.add(lesson.id);
    lesson.prerequisites = lesson.prerequisites.filter((parent) => !active.has(parent));
    for (const parent of lesson.prerequisites) { const dep = byId.get(parent); if (dep) visit(dep); }
    active.delete(lesson.id);
    visited.add(lesson.id);
    sorted.push(lesson);
  }
  for (const lesson of [...all].sort(preference)) visit(lesson);
  return { tracks: [...trackMap.values()], lessons: sorted };
}

export function getLesson(lessons: Lesson[], id: string) { return lessons.find((lesson) => lesson.id === id); }
export function nextLesson(lessons: Lesson[], completed: Set<string>) {
  return lessons.find((lesson) => !completed.has(lesson.id) && lesson.prerequisites.every((id) => completed.has(id)));
}
