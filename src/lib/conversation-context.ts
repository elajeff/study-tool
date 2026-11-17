import type { ImportedConversation } from "./conversation-import.ts";

type SourceTime = ImportedConversation["created_at"];
export type ConversationContext = { import_id: string; metadata: {
  created_at: SourceTime; updated_at: SourceTime; visible_messages: number;
  excluded: Record<string, number>; redactions: number;
} | null };

export function sourceTimeText(value: SourceTime): string {
  return value === null ? "unknown" : typeof value === "number" ? `${value} (Unix seconds)` : JSON.stringify(value);
}

export function conversationContextText(context: ConversationContext): string {
  const meta = context.metadata;
  if (!meta) return `Conversation import ${context.import_id}. Dates, branch selection and omission counts were not recorded by this import.`;
  const excluded = Object.entries(meta.excluded).sort(([a], [b]) => a.localeCompare(b)).map(([kind, count]) => `${JSON.stringify(kind)}=${count}`).join(", ") || "none recorded";
  return `Conversation import ${context.import_id}. Source-reported created: ${sourceTimeText(meta.created_at)}; updated: ${sourceTimeText(meta.updated_at)}.
Visible messages: ${meta.visible_messages}. Reconstruction exclusions/boundaries: ${excluded}. Possible credential replacements: ${meta.redactions}.
Only the selected supported visible conversation is included. Counts do not establish original completeness or correctness. Source dates do not establish truth or mastery.`;
}
