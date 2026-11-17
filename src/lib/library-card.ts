import type { LibraryArtifact, LibrarySource } from "./library-queries.ts";
import type { ExportRevision } from "./library-pack.ts";

export const LIBRARY_CARD_CHARACTER_LIMIT = 6000;
export type LearningSnapshot = { approved: { label: string; level: number; date: string }[];
  courses: string[] };

export function buildLibraryCard(collections: { source: LibrarySource; artifacts: LibraryArtifact[] }[],
  revisions: ExportRevision[], learning?: LearningSnapshot): string {
  const byId = new Map(revisions.map(revision => [revision.id, revision]));
  const lines = ["SOURCE HINTS — navigation only; tokens, extensions and folders are not verified concepts or prerequisites."];
  for (const { source, artifacts } of [...collections].sort((a, b) => a.source.short_code.localeCompare(b.source.short_code, undefined, { numeric: true }))) {
    const counts = new Map<string, number>();
    let characters = 0;
    for (const artifact of artifacts) {
      characters += byId.get(artifact.current_revision_id ?? "")?.content.length ?? 0;
      const path = artifact.path ?? "";
      const isChat = source.kind === "chatgpt" || source.kind === "claude";
      const title = artifact.external_id && path.endsWith(` [${artifact.external_id}]`) ? path.slice(0, -artifact.external_id.length - 3) : path;
      const hints = isChat ? [...new Set(title.toLocaleLowerCase().match(/[\p{L}][\p{L}\p{N}+#.-]{2,39}/gu) ?? [])]
        : source.kind === "repository" ? [path.match(/\.[^./]+$/)?.[0] ?? "(no extension)"] : [path.includes("/") ? path.split("/")[0] : "/"];
      for (const hint of hints) counts.set(hint, (counts.get(hint) ?? 0) + 1);
    }
    const hintKind = source.kind === "chatgpt" || source.kind === "claude" ? "title tokens" : source.kind === "repository" ? "extensions" : "folders";
    const hints = [...counts].sort(([a, x], [b, y]) => y - x || a.localeCompare(b)).slice(0, 5)
      .map(([word, count]) => `${JSON.stringify(Array.from(word).slice(0, 45).join(""))}=${count}`).join(", ");
    lines.push(`${source.short_code}: ${artifacts.length} items, ${characters} characters; ${hintKind}: ${hints || "none"}. Open ${source.short_code}/MAP/1.`);
  }
  const progress = learning ? ["LEARNING SNAPSHOT — reviewed assessment reports, not machine verification. Imported material and studied flags do not establish mastery.",
    `${learning.approved.length} latest approved assessment reports; ${learning.approved.filter(item => item.level >= 3).length} at level 3 or higher.`,
    ...learning.approved.slice(0, 8).map(item => JSON.stringify({ label: Array.from(item.label).slice(0, 120).join(""), level: item.level, date: item.date })),
    ...(learning.approved.length > 8 ? ["Only eight recent reports shown."] : []),
    `${learning.courses.length} saved courses; course activity is not demonstrated ability.`,
    ...learning.courses.slice(0, 5).map(item => JSON.stringify(Array.from(item).slice(0, 100).join(""))),
    ...(learning.courses.length > 5 ? ["Only five recent courses shown."] : [])]
    : ["LEARNING SNAPSHOT — not included. Imported material and studied flags do not establish mastery."];
  let card = "";
  for (const line of [...progress, ...lines]) {
    if (card.length + line.length + 150 > LIBRARY_CARD_CHARACTER_LIMIT) {
      card += "Some card details omitted. Use the full source list and maps below.\n"; break;
    }
    card += line + "\n";
  }
  return card;
}
