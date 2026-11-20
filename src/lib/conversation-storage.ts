import type { SupabaseClient } from "@supabase/supabase-js";
import type { ImportedConversation } from "./conversation-import.ts";

export type ConversationState = { artifact_id: string; external_id: string | null; revision_id: string | null; content_hash: string | null };
export async function loadConversationState(client: SupabaseClient, sourceId: string): Promise<ConversationState[]> {
  const state: ConversationState[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await client.from("source_artifacts")
      .select("id,external_id,current_revision_id,revision:source_revisions!artifact_current_revision_fk(content_hash)")
      .eq("source_id", sourceId).order("id").range(offset, offset + 499);
    if (error) throw new Error("Could not load saved conversation identities.");
    for (const item of data) state.push({ artifact_id: item.id, external_id: item.external_id,
      revision_id: item.current_revision_id, content_hash: (item.revision as unknown as { content_hash: string } | null)?.content_hash ?? null });
    if (data.length < 500) return state;
  }
}

export async function prepareConversationEntries(conversations: ImportedConversation[], state: ConversationState[]) {
  const byId = new Map(state.map(item => [item.external_id, item]));
  const encoder = new TextEncoder(), entries = [];
  const skipped: { id: string; title: string; reason: string }[] = [];
  for (const conversation of conversations) {
    const { id, title } = conversation;
    if (conversation.text.length > 500000 || conversation.text.includes("\0")) {
      skipped.push({ id, title, reason: "Text exceeds the storage limit or contains null characters." });
      continue;
    }
    const previous = byId.get(conversation.id);
    const path = `${Array.from(conversation.title).slice(0, 160).join("").replace(/[\/\\\x00-\x1f\x7f]/g, " ")} [${conversation.id}]`;
    if (encoder.encode(path).length > 1024 || encoder.encode(id).length > 1024) {
      skipped.push({ id, title, reason: "Title or identity exceeds the storage limit." });
      continue;
    }
    let byteOffset = 0, previousEnd = 0;
    const messages = conversation.messages.map(message => {
      byteOffset += encoder.encode(conversation.text.slice(previousEnd, message.start)).length;
      const start = byteOffset;
      byteOffset += encoder.encode(conversation.text.slice(message.start, message.end)).length;
      previousEnd = message.end;
      return { id: message.id, role: message.role, start, end: byteOffset, created_at: message.created_at };
    });
    const digest = await crypto.subtle.digest("SHA-256", encoder.encode(conversation.text));
    const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
    entries.push({ external_id: conversation.id, path, content: conversation.text, artifact_id: previous?.artifact_id ?? null,
      expected_revision_id: previous?.revision_id ?? null,
      metadata: { format: "study-conversation/1", provider: conversation.provider, offset_unit: "utf8", messages,
        created_at: conversation.created_at, updated_at: conversation.updated_at,
        excluded: conversation.excluded, redactions: conversation.redactions },
      status: !previous ? "New" : previous.content_hash === hash ? "Unchanged" : "Updated" });
  }
  return { entries, skipped };
}
