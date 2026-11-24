import { createHash } from "node:crypto";
import { noteRelationships, resolveNoteLink, titleFromPath, type SourceAlias } from "./notes.ts";

export type StudyProfile = {
  experience: string;
  goals: string;
  focus: string;
  hours_per_week: number;
};

type SourceNote = { path: string; title: string; body: string; topic?: string; source_id?: string | null; source_name?: string; artifact_id?: string | null };
type Track = { id: string; title: string; description: string };
export type Lesson = {
  id: string;
  track: string;
  title: string;
  prerequisites: string[];
  recommendations: string[];
  summary: string;
  sourcePath: string;
  sourceBody: string;
  sourceName: string;
  blocked: boolean;
};

function sourceId(path: string) {
  return `note-${createHash("sha256").update(path.toLowerCase()).digest("hex").slice(0, 20)}`;
}

function summary(body: string) {
  const paragraphs = body.replace(/^# [^\n]+\n/, "").split(/\n\s*\n/);
  const paragraph = paragraphs.find((part) => part.trim() && !part.trim().startsWith("#"));
  return paragraph?.trim().replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_match, path, label) => label || path).slice(0, 350)
    ?? "Open the source note.";
}

export function buildCurriculum(notes: SourceNote[], profile: StudyProfile | null, aliases: SourceAlias[] = []): { tracks: Track[]; lessons: Lesson[]; issues: string[] } {
  if (!profile) return { tracks: [], lessons: [], issues: [] };

  const issues: string[] = [];
  const paths = new Map<string, string>();
  const ids = new Map(notes.map((note) => [note, sourceId(note.topic ? `${note.topic}.md` : note.path)]));
  const scopes = new Map<string | null, SourceNote[]>();
  const aliasScopes = new Map<string, SourceAlias[]>();
  for (const alias of aliases) {
    const group = aliasScopes.get(alias.source_id) ?? [];
    group.push(alias);
    aliasScopes.set(alias.source_id, group);
  }
  for (const note of notes) {
    const scope = note.source_id ?? null;
    const group = scopes.get(scope) ?? [];
    group.push(note);
    scopes.set(scope, group);
    const key = `${scope ?? ""}:${note.path.toLowerCase()}`;
    const previous = paths.get(key);
    if (previous) issues.push(`Conflicting note paths: ${previous} and ${note.path}. Remove or rename one conflicting note before continuing.`);
    paths.set(key, note.path);
  }
  if (issues.length) return { tracks: [], lessons: [], issues };
  const tracks = new Map<string, Track>();
  const lessons: Lesson[] = [...notes].sort((a, b) =>
    (a.source_name ?? "").localeCompare(b.source_name ?? "") ||
    a.path.localeCompare(b.path, undefined, { numeric: true })).map((note) => {
    const folder = note.path.includes("/") ? note.path.split("/")[0] : "";
    const track = sourceId(JSON.stringify([note.source_id ?? null, folder]));
    if (!tracks.has(track)) {
      const source = note.source_name ?? "Notes";
      tracks.set(track, { id: track, title: folder || source, description: folder ? source : "" });
    }
    const relationships = noteRelationships(note.body);
    let blocked = false;
    const links = (kind: "prerequisite" | "recommendation") => [...new Set(relationships.filter((link) => link.kind === kind).flatMap((link) => {
      const result = resolveNoteLink(link.target, scopes.get(note.source_id ?? null) ?? [], aliasScopes.get(note.source_id ?? ""));
      if (result.state !== "resolved") {
        issues.push(`Missing or ambiguous link [[${link.target}]] in ${note.source_name ?? "Notes"}: ${note.path}, line ${link.line}. Review the link within the same vault.`);
        if (kind === "prerequisite") blocked = true;
      }
      const target = result.state === "resolved" ? result.note : undefined;
      return target && target !== note ? [ids.get(target)!] : [];
    }))];
    const prerequisites = links("prerequisite");
    const recommendations = links("recommendation");
    return {
      id: ids.get(note)!, track,
      title: note.title || titleFromPath(note.path), sourcePath: note.path, sourceBody: note.body,
      sourceName: note.source_name ?? "Notes",
      prerequisites, recommendations, blocked,
      summary: summary(note.body),
    };
  });

  const byId = new Map(lessons.map((lesson) => [lesson.id, lesson]));
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
  for (const lesson of lessons) visit(lesson);
  return { tracks: [...tracks.values()], lessons: sorted, issues };
}

export function getLesson(lessons: Lesson[], id: string) {
  return lessons.find((lesson) => lesson.id === id);
}
