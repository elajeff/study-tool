import type { SupabaseClient } from "@supabase/supabase-js";
import type { ConversationContext } from "./conversation-context.ts";

export async function loadConversationContexts(client: SupabaseClient, revisionIds: string[]): Promise<Map<string, ConversationContext>> {
  const contexts = new Map<string, ConversationContext>();
  for (let offset = 0; offset < revisionIds.length; offset += 500) {
    const { data, error } = await client.rpc("conversation_revision_context", { p_revision_ids: revisionIds.slice(offset, offset + 500) });
    if (error) throw new Error("Could not load conversation context. Check migration 009.");
    for (const row of data as { revision_id: string; context: ConversationContext }[]) contexts.set(row.revision_id, row.context);
  }
  return contexts;
}
