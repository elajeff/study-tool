import { createHash } from "node:crypto";
import { buildLibraryMaps } from "./library-map.ts";
import type { LibrarySource, LibraryArtifact } from "./library-queries.ts";
import type { ConversationContext } from "./conversation-context.ts";

export type ExportItem = {
  id: string; source_id: string; artifact_id: string; revision_id: string;
  path: string; content_hash: string; conversation?: ConversationContext;
};
export type ExportManifest = {
  format: "study-export/3"; export_id: string; sources: LibrarySource[];
  items: ExportItem[]; maps: { id: string; text: string }[];
};
export type ExportRevision = { id: string; artifact_id: string; content: string; content_hash: string };

export function prepareLibraryExport(collections: { source: LibrarySource; artifacts: LibraryArtifact[] }[], revisions: ExportRevision[], contexts: Map<string, ConversationContext>): ExportManifest {
  if (!collections.length || new Set(collections.map(({ source }) => source.id)).size !== collections.length
    || new Set(collections.map(({ source }) => source.short_code)).size !== collections.length)
    throw new Error("Select distinct Library sources with unique codes.");
  const ordered = [...collections].sort((a, b) => a.source.short_code.localeCompare(b.source.short_code, undefined, { numeric: true }));
  const byId = new Map(revisions.map(revision => [revision.id, revision]));
  const items = ordered.flatMap(({ source, artifacts }) => artifacts.map(artifact => {
    const revision = artifact.current_revision_id ? byId.get(artifact.current_revision_id) : null;
    if (!revision || revision.artifact_id !== artifact.id)
      throw new Error("A saved item has no matching revision. Resolve it before exporting.");
    if (createHash("sha256").update(revision.content).digest("hex") !== revision.content_hash)
      throw new Error("Source text does not match its saved hash.");
    const conversation = ["chatgpt", "claude"].includes(source.kind) ? contexts.get(revision.id) : undefined;
    if (["chatgpt", "claude"].includes(source.kind) && !conversation)
      throw new Error("A conversation has no accepted import context. Reload before exporting.");
    return { id: `${source.short_code}/${artifact.short_code}`, source_id: source.id, artifact_id: artifact.id,
      revision_id: revision.id, path: artifact.path ?? artifact.external_id ?? "(no path)", content_hash: revision.content_hash,
      ...(conversation ? { conversation } : {}) };
  })).sort((a, b) => a.id.localeCompare(b.id));
  const maps = ordered.flatMap(({ source, artifacts }) => buildLibraryMaps(source, artifacts).map(({ id, text }) => ({ id, text })));
  const payload = { format: "study-export/3" as const, sources: ordered.map(({ source }) => source), items, maps };
  return { ...payload, export_id: "X" + createHash("sha256").update(JSON.stringify(payload)).digest("hex") };
}
