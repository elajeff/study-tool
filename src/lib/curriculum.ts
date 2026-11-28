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
  prerequisiteWarning: string | null;
};

function sourceId(path: string) {
  return `note-${createHash("sha256").update(path.toLowerCase()).digest("hex").slice(0, 20)}`;
}

export function noteTopicId(topic: string): string {
  return sourceId(`${topic}.md`);
}

function summary(body: string) {
  const paragraphs = body.replace(/^# [^\n]+\n/, "").split(/\n\s*\n/);
  const paragraph = paragraphs.find((part) => part.trim() && !part.trim().startsWith("#"));
  return paragraph?.trim().replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_match, path, label) => label || path).slice(0, 350)
    ?? "Open the source note.";
}

export function buildCurriculum(notes: SourceNote[], aliases: SourceAlias[] = []): { tracks: Track[]; lessons: Lesson[]; issues: string[] } {
  const issues: string[] = [];
  const paths = new Map<string, string>();
  const ids = new Map(notes.map(note => [note, note.topic ? noteTopicId(note.topic) : sourceId(note.path)]));
  const scopes = new Map<string | null, SourceNote[]>();
  const conflictingScopes = new Set<string | null>();
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
    if (previous) {
      issues.push(`Conflicting note paths in ${note.source_name ?? "Notes"}: ${previous} and ${note.path}. Remove or rename one to browse this vault.`);
      conflictingScopes.add(scope);
    }
    paths.set(key, note.path);
  }
  const tracks = new Map<string, Track>();
  const lessons: Lesson[] = notes.filter(note => !conflictingScopes.has(note.source_id ?? null)).sort((a, b) =>
    (a.source_name ?? "").localeCompare(b.source_name ?? "") ||
    a.path.localeCompare(b.path, undefined, { numeric: true })).map((note) => {
    const folder = note.path.includes("/") ? note.path.split("/")[0] : "";
    const track = sourceId(JSON.stringify([note.source_id ?? null, folder]));
    if (!tracks.has(track)) {
      const source = note.source_name ?? "Notes";
      tracks.set(track, { id: track, title: folder || source, description: folder ? source : "" });
    }
    const relationships = noteRelationships(note.body);
    let prerequisiteWarning = null;
    const links = (kind: "prerequisite" | "recommendation") => [...new Set(relationships.filter((link) => link.kind === kind).flatMap((link) => {
      const result = resolveNoteLink(link.target, scopes.get(note.source_id ?? null) ?? [], aliasScopes.get(note.source_id ?? ""));
      if (result.state !== "resolved") {
        issues.push(`Missing or ambiguous link [[${link.target}]] in ${note.source_name ?? "Notes"}: ${note.path}, line ${link.line}. Review the link within the same vault.`);
        if (kind === "prerequisite") prerequisiteWarning = "Review missing or ambiguous prerequisites in this note.";
      }
      const target = result.state === "resolved" ? result.note : undefined;
      return target && (kind === "prerequisite" || target !== note) ? [ids.get(target)!] : [];
    }))];
    const prerequisites = links("prerequisite");
    const recommendations = links("recommendation");
    return {
      id: ids.get(note)!, track,
      title: note.title || titleFromPath(note.path), sourcePath: note.path, sourceBody: note.body,
      sourceName: note.source_name ?? "Notes",
      prerequisites, recommendations, prerequisiteWarning,
      summary: summary(note.body),
    };
  });

  const byId = new Map(lessons.map((lesson) => [lesson.id, lesson]));
  const sorted: Lesson[] = [];
  const visitOrder = new Map<string, number>();
  const pending: Lesson[] = [];
  const active = new Set<string>();
  function visit(lesson: Lesson): number {
    const order = visitOrder.size;
    visitOrder.set(lesson.id, order);
    pending.push(lesson);
    active.add(lesson.id);
    let earliest = order;
    for (const id of lesson.prerequisites) {
      const visited = visitOrder.get(id);
      if (visited === undefined) earliest = Math.min(earliest, visit(byId.get(id)!));
      else if (active.has(id)) earliest = Math.min(earliest, visited);
    }
    // When no link leads farther back, the pending group is complete.
    if (earliest === order) {
      const group: Lesson[] = [];
      let member: Lesson;
      do {
        member = pending.pop()!;
        active.delete(member.id);
        group.push(member);
      } while (member !== lesson);
      if (group.length > 1 || lesson.prerequisites.includes(lesson.id)) {
        for (const item of group) {
          item.prerequisiteWarning = "This note is part of a circular prerequisite. Check the linked notes.";
          issues.push(`Circular prerequisites involving ${item.sourceName}: ${item.sourcePath}.`);
        }
      }
    }
    sorted.push(lesson);
    return earliest;
  }
  for (const lesson of lessons) if (!visitOrder.has(lesson.id)) visit(lesson);
  return { tracks: [...tracks.values()], lessons: sorted, issues };
}

export function getLesson(lessons: Lesson[], id: string) {
  return lessons.find((lesson) => lesson.id === id);
}
