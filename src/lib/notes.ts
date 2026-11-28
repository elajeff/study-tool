export type Note = {
  id: string;
  path: string;
  title: string;
  body: string;
  source_id: string | null;
  artifact_id: string | null;
  topic: string;
  source_name: string;
};

/** Keep imported paths inside one vault; reject dot files and traversal. */
export function cleanNotePath(raw: string): string | null {
  const path = raw.replaceAll("\\", "/").replace(/^\/+/, "");
  if (!path || path.length > 240 || !path.toLowerCase().endsWith(".md")) return null;
  const parts = path.split("/");
  if (parts.some((part) => !part || part === "." || part === ".." || part.startsWith("."))) return null;
  return parts.join("/");
}

export function titleFromPath(path: string) {
  return path.split("/").at(-1)!.replace(/\.md$/i, "").slice(0, 160);
}

type NoteRelationship = { kind: "link" | "prerequisite" | "recommendation"; target: string; line: number };
export type SourceAlias = { source_id: string; artifact_id: string; path: string; current_path: string | null; current_revision_id: string | null };

export function noteRelationships(markdown: string): NoteRelationship[] {
  const links: NoteRelationship[] = [];
  const headings: { level: number; kind: NoteRelationship["kind"] }[] = [];
  let fence = "";
  for (const [index, line] of markdown.split(/\r?\n/).entries()) {
    const marker = line.match(/^\s{0,3}(`{3,}|~{3,})/);
    if (marker) {
      if (!fence) fence = marker[1];
      else if (marker[1][0] === fence[0] && marker[1].length >= fence.length && line.trim() === marker[1]) fence = "";
      continue;
    }
    if (fence) continue;
    const heading = line.match(/^\s{0,3}(#{1,6})\s+(.+?)(?:\s+#+)?\s*$/);
    if (heading) {
      while (headings.length && headings.at(-1)!.level >= heading[1].length) headings.pop();
      const title = heading[2];
      const kind = /^(required (conceptual )?foundations|required prerequisites|prerequisites|before you start)$/i.test(title) ? "prerequisite"
        : /^(recommended (study )?(preparation|background|reading)|preparation|related (study material|notes|concepts|reading))$/i.test(title) ? "recommendation"
          : headings.at(-1)?.kind ?? "link";
      headings.push({ level: heading[1].length, kind });
    }
    // Inline code examples are not assertions that a connection exists.
    const text = line.replace(/(`+)[\s\S]*?\1/g, "");
    for (const match of text.matchAll(/(?<!!)\[\[([^\]\n]+)\]\]/g)) {
      const target = match[1].split("|")[0].split("#")[0].trim();
      if (target) links.push({ kind: headings.at(-1)?.kind ?? "link", target, line: index + 1 });
    }
  }
  return links;
}

function notePathKey(path: string) {
  return path.replace(/\.md$/i, "").toLowerCase();
}

function groupBy<T>(items: T[], keyOf: (item: T) => string | null | undefined) {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    if (key == null) continue;
    const group = groups.get(key);
    if (group) group.push(item);
    else groups.set(key, [item]);
  }
  return groups;
}

export function noteLinkResolver<T extends { path: string; artifact_id?: string | null }>(notes: T[], aliases: SourceAlias[] = []) {
  const basename = (path: string) => notePathKey(path.slice(path.lastIndexOf("/") + 1));
  const paths = [groupBy(notes, note => notePathKey(note.path)), groupBy(notes, note => basename(note.path))];
  const aliasPaths = [groupBy(aliases, alias => notePathKey(alias.path)), groupBy(aliases, alias => basename(alias.path))];
  const byArtifact = groupBy(notes, note => note.artifact_id);

  return (target: string): { state: "resolved"; note: T } | { state: "missing" | "ambiguous" } => {
    const key = notePathKey(target);
    for (let index = 0; index < paths.length; index++) {
      const identities = new Set(aliasPaths[index].get(key)?.map(alias => alias.artifact_id));
      const candidates = new Set(paths[index].get(key));
      for (const id of identities) {
        for (const note of byArtifact.get(id) ?? []) candidates.add(note);
      }
      for (const note of candidates) identities.add(note.artifact_id ?? note.path);
      if (identities.size > 1) return { state: "ambiguous" };
      if (identities.size === 1) {
        const [note] = candidates;
        return candidates.size === 1 ? { state: "resolved", note } : { state: "missing" };
      }
    }
    return { state: "missing" };
  };
}


export function shouldImportNote(path: string) {
  return !!cleanNotePath(path) && !/(^|\/)ai chats\//i.test(path);
}

export function vaultRoot(paths: string[], directories: string[] = []): string | null {
  const roots = new Set<string>();
  for (const path of [...paths, ...directories]) {
    const parts = path.split("/");
    const marker = parts.indexOf(".obsidian");
    if (marker !== -1) roots.add(parts.slice(0, marker).join("/"));
  }
  if (roots.size > 1) throw new Error("This ZIP contains multiple Obsidian vaults. Import them separately.");
  return [...roots][0] || null;
}
