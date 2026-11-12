export type Note = {
  id: string;
  path: string;
  title: string;
  body: string;
  updated_at: string;
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

export type NoteRelationship = { kind: "link" | "prerequisite" | "recommendation"; target: string; line: number; heading: string | null };
export type SourceAlias = { source_id: string; artifact_id: string; path: string; current_path: string | null; current_revision_id: string | null };

export function noteRelationships(markdown: string): NoteRelationship[] {
  const links: NoteRelationship[] = [];
  const headings: { level: number; title: string; kind: NoteRelationship["kind"] }[] = [];
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
      headings.push({ level: heading[1].length, title, kind });
    }
    // Inline code examples are not assertions that a connection exists.
    const text = line.replace(/(`+)[\s\S]*?\1/g, "");
    for (const match of text.matchAll(/(?<!!)\[\[([^\]\n]+)\]\]/g)) {
      const target = match[1].split("|")[0].split("#")[0].trim();
      if (target) links.push({ kind: headings.at(-1)?.kind ?? "link", target, line: index + 1, heading: headings.at(-1)?.title ?? null });
    }
  }
  return links;
}

export function wikiLinks(markdown: string): string[] {
  return [...new Set(noteRelationships(markdown).map((link) => link.target))];
}

export function resolveNoteLink<T extends { path: string; artifact_id?: string | null }>(target: string, notes: T[], aliases: SourceAlias[] = []):
  { state: "resolved"; note: T } | { state: "missing" | "ambiguous" } {
  const normalized = target.replace(/\.md$/i, "").toLowerCase();
  for (const basename of [false, true]) {
    const matches = (path: string) => {
      const clean = path.replace(/\.md$/i, "").toLowerCase();
      return (basename ? clean.split("/").at(-1) : clean) === normalized;
    };
    const identities = new Set(aliases.filter((alias) => matches(alias.path)).map((alias) => alias.artifact_id));
    const candidates = notes.filter((note) => matches(note.path) || (note.artifact_id && identities.has(note.artifact_id)));
    for (const note of candidates) identities.add(note.artifact_id ?? note.path);
    if (identities.size > 1) return { state: "ambiguous" };
    if (identities.size === 1) return candidates.length === 1 ? { state: "resolved", note: candidates[0] } : { state: "missing" };
  }
  return { state: "missing" };
}


/** Skip Obsidian metadata and generated records during study-note import. */
export function shouldImportNote(path: string) {
  return !!cleanNotePath(path) && !/^(ai chats|progress|tools|\.obsidian|\.trash)\//i.test(path)
    && !/^research\/source-manifest\.json$/i.test(path);
}

/** ZIP exports sometimes include the vault directory above the Markdown folders. */
export function vaultRoot(paths: string[]): string | null {
  const namedFolders = new Set(["lessons", "dsa", "foundations", "concepts", "learning projects", "walkthroughs", "learning paths", "progress", "ai chats"]);
  const parts = paths.map((path) => path.replaceAll("\\", "/").split("/"));
  const root = parts[0]?.[0];
  if (!root || !parts.every((part) => part[0] === root && part.length > 1)) return null;
  const looksLikeVault = parts.some((part) => namedFolders.has(part[1]?.toLowerCase()) || part[1]?.toLowerCase() === "home.md");
  return looksLikeVault ? root : null;
}
