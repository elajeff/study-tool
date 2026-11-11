export type Note = {
  id: string;
  path: string;
  title: string;
  body: string;
  updated_at: string;
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

export function wikiLinks(markdown: string): string[] {
  const links = new Set<string>();
  for (const match of markdown.matchAll(/\[\[([^\]\n]+)\]\]/g)) {
    const target = match[1].split("|")[0].split("#")[0].trim();
    if (target) links.add(target);
  }
  return [...links];
}

export function findLinkedNote(target: string, notes: Pick<Note, "path">[]) {
  const normalized = target.replace(/\.md$/i, "").toLowerCase();
  return notes.find((note) => note.path.replace(/\.md$/i, "").toLowerCase() === normalized)
    ?? notes.find((note) => note.path.replace(/\.md$/i, "").split("/").at(-1)?.toLowerCase() === normalized);
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
