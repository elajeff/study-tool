import type { SupabaseClient } from "@supabase/supabase-js";
import type { ChatProvider } from "./conversation-import.ts";
import { loadLibrarySources } from "./library-queries.ts";

export type ChatReference = { path: string; provider: ChatProvider; id: string };
type SavedChat = { reference: string; revisionId: string | null };
export type ChatReferenceMatch = ChatReference & { items: SavedChat[] };

// Recognize explicit provenance only. Titles and links in conversation bodies are not identities.
export function chatBridgeReference(markdown: string): { provider: ChatProvider; id: string } | null {
  const front = markdown.replace(/^\uFEFF/, "").match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!front) return null;
  const fields = new Map<string, string>();
  for (const line of front[1].split(/\r?\n/)) {
    const field = line.match(/^(uuid|url):\s*(.*?)\s*$/);
    if (!field) continue;
    if (fields.has(field[1])) return null;
    const value = field[2].replace(/^(?:"([^"\\]*)"|'([^']*)')$/, (_match, double, single) => double ?? single);
    fields.set(field[1], value);
  }
  const url = fields.get("url")?.match(/^https:\/\/(chatgpt\.com\/c|chat\.openai\.com\/c|claude\.ai\/chat)\/([a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})\/?(?:[?#][^\s]*)?$/i);
  if (!url || fields.get("uuid")?.toLowerCase() !== url[2].toLowerCase()) return null;
  return { provider: url[1].toLowerCase().startsWith("claude.") ? "claude" : "chatgpt", id: url[2].toLowerCase() };
}

export async function matchChatReferences(client: SupabaseClient, references: ChatReference[]): Promise<ChatReferenceMatch[]> {
  if (!references.length) return [];
  const matches = new Map<string, SavedChat[]>();
  const sources = (await loadLibrarySources(client)).filter(source => source.kind === "chatgpt" || source.kind === "claude");
  for (const source of sources) {
    const ids = [...new Set(references.filter(reference => reference.provider === source.kind).map(reference => reference.id))];
    for (let start = 0; start < ids.length; start += 100) {
      // Provider IDs are unique within a source, so this batch can return at most 100 rows.
      const { data, error } = await client.from("source_artifacts").select("external_id,short_code,current_revision_id")
        .eq("source_id", source.id).in("external_id", ids.slice(start, start + 100)).limit(100);
      if (error) throw new Error("Could not match vault conversation references.");
      for (const item of data) {
        const key = `${source.kind}:${item.external_id}`;
        matches.set(key, [...(matches.get(key) ?? []), { reference: `${source.short_code}/${item.short_code}`, revisionId: item.current_revision_id }]);
      }
    }
  }
  return references.map(reference => ({ ...reference, items: matches.get(`${reference.provider}:${reference.id}`) ?? [] }));
}
