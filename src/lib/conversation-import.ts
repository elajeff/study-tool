import { redactConversationText } from "./import-privacy.ts";

export type ChatProvider = "chatgpt";
// UTF-16 offsets address the rendered message block, including its role label.
type SourceTime = string | number | null;
export type ConversationMessage = { id: string; role: "user" | "assistant"; text: string; start: number; end: number; created_at: SourceTime };
export type ImportedConversation = { id: string; provider: ChatProvider; title: string; text: string; messages: ConversationMessage[];
  created_at: SourceTime; updated_at: SourceTime; excluded: Record<string, number>; redactions: number };
class ConversationFormatError extends Error {}
type Row = Record<string, unknown>;
function row(value: unknown): Row {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ConversationFormatError("Expected an export object.");
  return value as Row;
}
function identifier(value: unknown): string {
  if (typeof value !== "string" || !value || value.length > 1024) throw new ConversationFormatError("Missing or invalid conversation identity.");
  return value;
}
function sourceTime(value: unknown): SourceTime {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) return value;
  if (typeof value === "string" && value.length <= 64 && Number.isFinite(Date.parse(value))) return value;
  return null;
}

function chatgptNodes(record: Row, excluded: Record<string, number>): { id: string; message: Row }[] {
  const mapping = row(record.mapping), chain: { id: string; message: Row }[] = [], visited = new Set<string>();
  let current: unknown = identifier(record.current_node);
  while (current !== null && current !== undefined) {
    const id = identifier(current);
    if (visited.has(id)) throw new ConversationFormatError("Cycle in the selected conversation branch.");
    if (!Object.hasOwn(mapping, id)) throw new ConversationFormatError("Selected branch references a missing node.");
    visited.add(id);
    const node = row(mapping[id]);
    if (node.message) chain.push({ id, message: row(node.message) });
    if (!Object.hasOwn(node, "parent")) throw new ConversationFormatError("A branch node has no parent metadata.");
    current = node.parent;
  }
  excluded.other_branch_nodes = Object.keys(mapping).length - visited.size;
  return chain.reverse();
}

export function parseConversationExport(raw: string) {
  if (raw.length > 100 * 1024 * 1024) throw new ConversationFormatError("Select an export smaller than 100 MiB.");
  const records: unknown = JSON.parse(raw);
  if (!Array.isArray(records)) throw new ConversationFormatError("Select a conversations JSON array, not account or settings files.");
  const conversations: ImportedConversation[] = [], rejected: { index: number; reason: string }[] = [];
  let empty = 0, duplicates = 0;
  const identities = new Map<string, { signature: string; index: number }>(), conflicts = new Set<string>();
  for (const [index, value] of records.entries()) {
    try {
      const record = row(value), id = identifier(record.conversation_id ?? record.id);
      const excluded: Record<string, number> = {};
      const skip = (reason: string) => { excluded[reason] = (excluded[reason] ?? 0) + 1; };
      const nodes = chatgptNodes(record, excluded);
      const title = redactConversationText(typeof (record.title ?? record.name) === "string" ? String(record.title ?? record.name) : "Untitled conversation");
      let redactions = title.redactions, text = `# ${JSON.stringify(title.text)}\n`;
      const messages: ConversationMessage[] = [];
      for (const node of nodes) {
        const message = node.message, author = message.author && typeof message.author === "object" ? row(message.author) : {};
        const role = author.role;
        const metadata = message.metadata && typeof message.metadata === "object" ? row(message.metadata) : {};
        if (metadata.is_visually_hidden_from_conversation === true) { skip("hidden_messages"); continue; }
        if (role !== "user" && role !== "assistant") { skip("non_dialogue_messages"); continue; }
        if (message.channel === "analysis" || (role === "assistant" && message.recipient != null && message.recipient !== "all")) { skip("internal_messages"); continue; }
        const parts: string[] = [];
        const content = row(message.content);
        if (content.content_type !== "text" && content.content_type !== "multimodal_text") {
          skip(content.content_type === "thoughts" || content.content_type === "reasoning_recap" ? content.content_type : "unsupported_message_types"); continue;
        }
        if (!Array.isArray(content.parts)) throw new ConversationFormatError("Visible message has no text parts.");
        for (const part of content.parts) {
          if (typeof part === "string") parts.push(part);
          else {
            const type = part && typeof part === "object" ? row(part).content_type : undefined;
            if (type === "image_asset_pointer") parts.push("[image not analyzed]");
            else if (type === "file") parts.push("[file not analyzed]");
            else { skip("unsupported_parts"); parts.push("[unsupported non-text part]"); }
          }
        }
        if (Array.isArray(message.attachments) && message.attachments.length || Array.isArray(message.files) && message.files.length
          || Array.isArray(metadata.attachments) && metadata.attachments.length) { parts.push("[attachments not analyzed]"); skip("attachments"); }
        const cleaned = redactConversationText(parts.join("\n"));
        redactions += cleaned.redactions;
        if (!cleaned.text.trim()) continue;
        const start = text.length;
        text += `\n${role.toUpperCase()}\n${cleaned.text}\n`;
        messages.push({ id: node.id, role, text: cleaned.text, start, end: text.length,
          created_at: sourceTime(message.create_time) });
      }
      if (!messages.length) { empty++; continue; }
      const created_at = sourceTime(record.create_time);
      const updated_at = sourceTime(record.update_time);
      const signature = JSON.stringify([title.text, created_at, updated_at, messages.map(item => [item.id, item.role, item.text, item.created_at])]);
      if (conflicts.has(id)) throw new ConversationFormatError("Conflicting copies of one conversation; select one version.");
      const previous = identities.get(id);
      if (previous) {
        if (previous.signature !== signature) {
          conflicts.add(id);
          conversations.splice(conversations.findIndex(item => item.id === id), 1);
          rejected.push({ index: previous.index, reason: "Conflicting copies of one conversation; no version selected." });
          throw new ConversationFormatError("Conflicting copies of one conversation; select one version.");
        }
        duplicates++; continue;
      }
      identities.set(id, { signature, index });
      conversations.push({ id, provider: "chatgpt", title: title.text, text, messages, created_at, updated_at, excluded, redactions });
    } catch (error) {
      if (!(error instanceof ConversationFormatError)) throw error;
      rejected.push({ index, reason: error.message });
    }
  }
  return { conversations, rejected, empty, duplicates };
}
