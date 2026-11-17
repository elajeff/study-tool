import type { LibraryArtifact } from "./library-queries.ts";
import type { ExportManifest } from "./library-pack.ts";
import type { ConversationContext } from "./conversation-context.ts";
import { inspectImportText } from "./import-privacy.ts";

export type DigestContext = ConversationContext["metadata"];
export type LibraryDigest = { id: string; revision_id: string; path: string; context: DigestContext; summary: string };
export type DigestBlock = { format: "study-digest/1"; export_id: string; items: { id: string; summary: string }[] };

function digestContextKey(context: DigestContext): string {
  return JSON.stringify(context === null ? null : [context.created_at, context.updated_at, context.visible_messages,
    context.redactions, Object.entries(context.excluded).sort(([a], [b]) => a.localeCompare(b))]);
}

export function parseDigest(raw: string, manifest: ExportManifest): DigestBlock {
  if (new TextEncoder().encode(raw).length > 200000) throw new Error("Digest text exceeds 200,000 UTF-8 bytes.");
  const blocks = [...raw.matchAll(/^```(?:study-digest|json)\s*\r?\n([\s\S]*?)^```\s*$/gm)];
  if (blocks.length > 1) throw new Error("Import one complete digest at a time.");
  const value: unknown = JSON.parse(blocks.length ? blocks[0][1] : raw);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected a digest JSON object.");
  const block = value as Record<string, unknown>;
  if (block.format !== "study-digest/1" || block.export_id !== manifest.export_id)
    throw new Error("Digest export_id must match this saved export. Include the identity from its instructions.");
  if (!Array.isArray(block.items) || !block.items.length || block.items.length > 500)
    throw new Error("Import between 1 and 500 item summaries.");
  const known = new Set(manifest.items.map(item => item.id)), seen = new Set<string>();
  const items = block.items.map(value => {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected an item summary object.");
    const item = value as Record<string, unknown>;
    if (typeof item.id !== "string" || !known.has(item.id) || seen.has(item.id)) throw new Error("Digest IDs must be distinct items in this export.");
    if (typeof item.summary !== "string" || !item.summary.trim() || Array.from(item.summary.trim()).length > 200 || /[\r\n\0]/.test(item.summary))
      throw new Error("Each summary must be one nonempty line of at most 200 characters.");
    const summary = item.summary.trim();
    if (inspectImportText(summary).blocked) throw new Error("A summary contains a known credential pattern. Remove it before importing.");
    seen.add(item.id);
    return { id: item.id, summary };
  });
  return { format: "study-digest/1", export_id: manifest.export_id, items };
}

// Candidates arrive newest first; content and reconstruction context must both match.
export function currentLibraryDigests(artifacts: LibraryArtifact[], contexts: Map<string, ConversationContext>, candidates: LibraryDigest[]): Map<string, LibraryDigest> {
  const byVersion = new Map<string, LibraryDigest>();
  for (const digest of candidates) {
    const key = JSON.stringify([digest.revision_id, digest.path, digestContextKey(digest.context)]);
    if (!byVersion.has(key)) byVersion.set(key, digest);
  }
  const selected = new Map<string, LibraryDigest>();
  for (const artifact of artifacts) {
    const revision = artifact.current_revision_id;
    const digest = revision ? byVersion.get(JSON.stringify([revision, artifact.path ?? artifact.external_id ?? "(no path)", digestContextKey(contexts.get(revision)?.metadata ?? null)])) : undefined;
    if (digest) selected.set(artifact.id, digest);
  }
  return selected;
}
