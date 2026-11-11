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

const categories = [
  { folder: "Lessons/Java/", id: "java", title: "Java", description: "Programming fundamentals" },
  { folder: "DSA/", id: "algorithms", title: "Algorithms", description: "Problem solving and interview practice" },
  { folder: "Foundations/", id: "foundations", title: "Foundations", description: "Tools, data, networking and concurrency" },
  { folder: "Learning Projects/", id: "projects", title: "Projects", description: "Practice with real applications" },
  { folder: "Concepts/", id: "concepts", title: "Concepts", description: "Technical reference topics" },
  { folder: "Walkthroughs/", id: "walkthroughs", title: "Walkthroughs", description: "Tracing implementations through source code" },
];

function titleFromPath(path: string) {
  return path.split("/").at(-1)?.replace(/\.md$/i, "") ?? path;
}

export function topicPath(path: string) {
  return path.replace(/\.md$/i, "");
}

function sourceId(path: string) {
  return `note-${createHash("sha256").update(path.toLowerCase()).digest("hex").slice(0, 20)}`;
}

function section(body: string, name: RegExp) {
  const lines = body.split(/\r?\n/);
  const index = lines.findIndex((line) => /^##\s+/.test(line) && name.test(line.slice(3).trim()));
  if (index === -1) return "";
  const end = lines.findIndex((line, i) => i > index && /^#{1,2}\s+/.test(line));
  return lines.slice(index + 1, end === -1 ? undefined : end).join("\n").trim();
}

function summary(body: string) {
  const paragraphs = body.replace(/^# [^\n]+\n/, "").split(/\n\s*\n/);
  const paragraph = paragraphs.find((part) => part.trim() && !part.trim().startsWith("#"));
  return paragraph?.trim().replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_match, path, label) => label || path).slice(0, 350)
    ?? "Open the source note to explore this topic.";
}

function goalPriority(title: string, profile: StudyProfile) {
  const words = `${profile.goals} ${profile.focus}`.toLowerCase().match(/[a-z][a-z0-9+#-]{2,}/g) ?? [];
  let score = words.filter((word) => title.toLowerCase().includes(word)).length * 5;
  if (profile.experience.toLowerCase().includes("java") && title.toLowerCase().includes("java")) score += 8;
  return score;
}

function categoryOf(path: string) {
  return categories.find((category) => path.toLowerCase().startsWith(category.folder.toLowerCase()));
}

function isTopic(path: string) {
  if (!path.toLowerCase().endsWith(".md")) return false;
  if (/^(ai chats|progress|tools|research|maps|learning paths)\//i.test(path)) return false;
  if (/(^|\/)(00 [^/]*|readme|source index|source audit|manifest|home)\.md$/i.test(path)) return false;
  if (/^projects\//i.test(path) || /\/testing\.md$/i.test(path)) return false;
  return true;
}

export function buildCurriculum(allNotes: SourceNote[], profile: StudyProfile | null): { tracks: Track[]; lessons: Lesson[]; issues: string[] } {
  if (!profile) return { tracks: [], lessons: [], issues: [] };

  const candidates = allNotes.filter((note) => isTopic(note.path));
  const issues: string[] = [];
  const paths = new Map<string, string>();
  for (const note of candidates) {
    const key = note.path.toLowerCase();
    const previous = paths.get(key);
    if (previous) issues.push(`Conflicting note paths: ${previous} and ${note.path}. Remove or rename one conflicting note before continuing.`);
    paths.set(key, note.path);
  }
  if (issues.length) return { tracks: [], lessons: [], issues };
  const structured = candidates.some((note) => /^(lessons\/java|dsa|foundations|learning projects|walkthroughs)\//i.test(note.path));

  const trackMap = new Map<string, Track>();
  const outlineTrack = new Map<string, string>();
  const outlineRank = new Map<string, number>();
  if (!structured) {
    const outlines = allNotes.filter((note) => /^learning paths\//i.test(note.path));
    for (const outline of outlines.sort((a, b) => a.path.localeCompare(b.path))) {
      const id = sourceId(outline.path);
      let rank = 0;
      for (const link of wikiLinks(outline.body)) {
        const target = findLinkedNote(link, candidates);
        if (target && !outlineTrack.has(target.path)) {
          outlineTrack.set(target.path, id);
          outlineRank.set(target.path, rank++);
        }
      }
      if (rank) trackMap.set(id, {
        id, title: titleFromPath(outline.path).replace(/^\d+\s*/, ""),
        description: `From ${outline.path}`,
      });
    }
  }
  for (const category of categories) {
    if (candidates.some((note) => categoryOf(note.path)?.id === category.id && !outlineTrack.has(note.path))) {
      trackMap.set(category.id, { id: category.id, title: category.title, description: category.description });
    }
  }
  if (candidates.some((note) => !outlineTrack.has(note.path) && !categoryOf(note.path))) {
    trackMap.set("your-notes", { id: "your-notes", title: "Your notes", description: "Other imported study material" });
  }

  const raw = candidates.map((note) => {
    const required = section(note.body, /^(required (conceptual )?foundations|required prerequisites|prerequisites|before you start)$/i);
    const recommended = section(note.body, /^(recommended (study )?(preparation|background|reading)|preparation)$/i);
    const paths = (text: string) => [...new Set(wikiLinks(text)
      .map((link) => findLinkedNote(link, candidates)?.path)
      .filter((path): path is string => !!path && path !== note.path))];
    const code = note.body.match(/```[^\n]*\n([\s\S]*?)\n```/);
    const questions = section(note.body, /^(what you should be able to explain|practice( on your own)?|exercises?|original practice problem)$/i);
    const exercise = questions.split("\n").map((line) => line.replace(/^[-*\d.)\s]+/, "").trim()).find(Boolean);
    return {
      id: sourceId(note.path), track: outlineTrack.get(note.path) ?? categoryOf(note.path)?.id ?? "your-notes",
      title: note.title || titleFromPath(note.path), sourcePath: note.path, sourceBody: note.body,
      prerequisites: paths(required), recommendations: paths(recommended),
      summary: summary(note.body), explanation: summary(note.body), example: code?.[1] ?? "",
      exercise: exercise || `Explain ${note.title || titleFromPath(note.path)} and try a new example.`,
      completion: "Show independent work in an assessment and approve the evidence before counting mastery.",
    };
  });

  const byPath = new Map(raw.map((topic) => [topic.sourcePath, topic.id]));
  const lessons = raw.map((topic) => ({
    ...topic,
    prerequisites: topic.prerequisites.map((path) => byPath.get(path)).filter((id): id is string => !!id),
    recommendations: topic.recommendations.map((path) => byPath.get(path)).filter((id): id is string => !!id),
  }));
  const byId = new Map(lessons.map((lesson) => [lesson.id, lesson]));
  const rank = new Map([...trackMap.keys()].map((id, i) => [id, i]));
  const sorted: Lesson[] = [];
  const done = new Set<string>();
  const active = new Set<string>();
  function visit(lesson: Lesson) {
    if (done.has(lesson.id)) return;
    if (active.has(lesson.id)) {
      issues.push(`Circular prerequisites involving ${lesson.sourcePath}. Check the linked prerequisite notes.`);
      return;
    }
    active.add(lesson.id);
    for (const id of lesson.prerequisites) {
      const previous = byId.get(id);
      if (previous) visit(previous);
    }
    active.delete(lesson.id);
    done.add(lesson.id);
    sorted.push(lesson);
  }
  for (const lesson of [...lessons].sort((a, b) =>
    (rank.get(a.track) ?? 999) - (rank.get(b.track) ?? 999)
    || (outlineRank.get(a.sourcePath) ?? 999) - (outlineRank.get(b.sourcePath) ?? 999)
    || (structured ? a.sourcePath.localeCompare(b.sourcePath, undefined, { numeric: true }) : goalPriority(b.title, profile) - goalPriority(a.title, profile))
    || a.title.localeCompare(b.title))) visit(lesson);
  return { tracks: [...trackMap.values()], lessons: sorted, issues };
}

export function getLesson(lessons: Lesson[], id: string) {
  return lessons.find((lesson) => lesson.id === id);
}

export function nextLesson(lessons: Lesson[], demonstrated: Set<string>) {
  return lessons.find((lesson) => !demonstrated.has(lesson.id) && lesson.prerequisites.every((id) => demonstrated.has(id)));
}
