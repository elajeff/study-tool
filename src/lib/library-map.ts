import type { LibrarySource, LibraryArtifact } from "./library-queries.ts";

export type MapEntry = { id: string; label: string; artifact?: LibraryArtifact };
export type LibraryMap = {
  id: string; text: string; entries: MapEntry[]; next: string | null;
  characters: number; estimatedTokens: number;
};

export const MAP_CHARACTER_LIMIT = 4000;

// Labels are navigation, not source text. The item view retains the full path and body.
function label(text: string) {
  const quoted = JSON.stringify(text);
  return quoted.length > 260 ? quoted.slice(0, 259) + "… [label shortened]" : quoted;
}

function pages(prefix: string, heading: string, entries: MapEntry[]): LibraryMap[] {
  const groups: MapEntry[][] = [[]];
  let size = 0;
  // Reserve space for the heading, page ID and continuation reference.
  const available = MAP_CHARACTER_LIMIT - heading.length - 160;
  for (const entry of entries) {
    const length = entry.id.length + entry.label.length + 3;
    if (size + length > available && groups.at(-1)!.length) {
      groups.push([]); size = 0;
    }
    groups.at(-1)!.push(entry); size += length;
  }
  return groups.map((group, index) => {
    const id = `${prefix}/${index + 1}`;
    const next = index + 1 < groups.length ? `${prefix}/${index + 2}` : null;
    const text = [`MAP ${id}`, heading, ...group.map(entry => `${entry.id}  ${entry.label}`),
      next ? `NEXT ${next}` : "END MAP"].join("\n");
    return { id, text, entries: group, next, characters: text.length, estimatedTokens: Math.ceil(text.length / 4) };
  });
}

export function buildLibraryMaps(source: LibrarySource, artifacts: LibraryArtifact[], summaries = new Map<string, string>()): LibraryMap[] {
  const folders = new Map<string, LibraryArtifact[]>();
  for (const artifact of artifacts) {
    const path = artifact.path ?? "";
    const folder = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
    if (!folders.has(folder)) folders.set(folder, []);
    folders.get(folder)!.push(artifact);
  }
  const details: LibraryMap[] = [];
  const directoryEntries: MapEntry[] = [];
  for (const [index, [folder, files]] of [...folders].sort(([a], [b]) => a.localeCompare(b)).entries()) {
    const prefix = `${source.short_code}/D${index + 1}`;
    const maps = pages(prefix, `Folder ${label(folder || "/")}. Shortened labels can be opened in full.`,
      files.sort((a, b) => a.short_code.localeCompare(b.short_code, undefined, { numeric: true })).map(artifact => ({
        id: `${source.short_code}/${artifact.short_code}`,
        label: label(artifact.path ?? artifact.external_id ?? "(no path)") + (artifact.current_revision_id ? "" : " [no saved text]")
          + (summaries.has(artifact.id) ? ` — AI summary, unverified: ${JSON.stringify(summaries.get(artifact.id))}` : ""),
        artifact,
      })));
    directoryEntries.push({ id: maps[0].id, label: `${label(folder || "/")} — items: ${files.length}; pages: ${maps.length}` });
    details.push(...maps);
  }
  const heading = `${label(source.name)}: ${artifacts.length} saved items. This collection may span imports. Original omissions are unknown.`;
  return [...pages(`${source.short_code}/MAP`, heading, directoryEntries), ...details];
}
