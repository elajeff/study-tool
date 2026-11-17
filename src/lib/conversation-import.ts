import { redactConversationText } from "./import-privacy.ts";

export type ChatProvider = "chatgpt" | "claude";
// UTF-16 offsets address the rendered message block, including its role label.
type SourceTime = string | number | null;
export type ConversationMessage = { id: string; role: "user" | "assistant"; text: string; start: number; end: number; created_at: SourceTime };
export type ImportedConversation = { id: string; provider: ChatProvider; title: string; text: string; messages: ConversationMessage[];
  created_at: SourceTime; updated_at: SourceTime; excluded: Record<string, number>; redactions: number; pages: { start: number; end: number }[] };
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

function claudeNodes(record: Row, excluded: Record<string, number>): { id: string; message: Row }[] {
  if (!Array.isArray(record.chat_messages)) throw new ConversationFormatError("Missing Claude messages.");
  const messages = record.chat_messages.map((value, index) => ({ id: typeof row(value).uuid === "string" ? identifier(row(value).uuid) : `index:${index}`, message: row(value) }));
  if (!messages.length) return [];
  if (messages.every(item => item.message.parent_message_uuid === undefined)) {
    excluded.unavailable_branch_metadata = 1; return messages;
  }
  const byId = new Map(messages.map(item => [item.id, item]));
  if (byId.size !== messages.length) throw new ConversationFormatError("Duplicate Claude message identity.");
  const parents = new Set(messages.map(item => item.message.parent_message_uuid));
  const leaves = messages.filter(item => !parents.has(item.id));
  if (leaves.length !== 1) throw new ConversationFormatError("Claude export has ambiguous branches; no active branch was specified.");
  const chain: typeof messages = [], visited = new Set<string>();
  let current: typeof messages[number] | undefined = leaves[0];
  while (current) {
    if (visited.has(current.id)) throw new ConversationFormatError("Cycle in Claude messages.");
    visited.add(current.id); chain.push(current);
    const parent: unknown = current.message.parent_message_uuid;
    if (parent !== null && typeof parent !== "string") throw new ConversationFormatError("Incomplete Claude parent metadata.");
    current = typeof parent === "string" ? byId.get(parent) : undefined;
  }
  if (visited.size !== messages.length) throw new ConversationFormatError("Claude messages do not form one complete branch.");
  // Claude may reference an external root sentinel. Retain the boundary explicitly.
  if (chain.at(-1)!.message.parent_message_uuid) excluded.external_root_boundary = 1;
  return chain.reverse();
}

export function parseConversationExport(raw: string | string[], provider: ChatProvider = "chatgpt") {
  const inputs = typeof raw === "string" ? [raw] : raw;
  if (inputs.reduce((size, input) => size + input.length, 0) > 100 * 1024 * 1024) throw new ConversationFormatError("Select export shards smaller than 100 MiB combined.");
  const records = inputs.flatMap(input => {
    const parsed: unknown = JSON.parse(input);
    if (!Array.isArray(parsed)) throw new ConversationFormatError("Select conversations JSON arrays, not account or settings files.");
    return parsed;
  });
  const conversations: ImportedConversation[] = [], rejected: { index: number; reason: string }[] = [];
  let empty = 0, duplicates = 0;
  const identities = new Map<string, { signature: string; index: number }>(), conflicts = new Set<string>();
  for (const [index, value] of records.entries()) {
    try {
      const record = row(value), id = identifier(provider === "chatgpt" ? record.conversation_id ?? record.id : record.uuid ?? record.id);
      const excluded: Record<string, number> = {};
      const skip = (reason: string) => { excluded[reason] = (excluded[reason] ?? 0) + 1; };
      const nodes = provider === "chatgpt" ? chatgptNodes(record, excluded) : claudeNodes(record, excluded);
      const title = redactConversationText(typeof (record.title ?? record.name) === "string" ? String(record.title ?? record.name) : "Untitled conversation");
      let redactions = title.redactions, text = `# ${JSON.stringify(title.text)}\n`;
      const messages: ConversationMessage[] = [], pages: { start: number; end: number }[] = [];
      for (const node of nodes) {
        const message = node.message, author = message.author && typeof message.author === "object" ? row(message.author) : {};
        const role = provider === "chatgpt" ? author.role : message.sender === "human" ? "user" : message.sender;
        const metadata = message.metadata && typeof message.metadata === "object" ? row(message.metadata) : {};
        if (metadata.is_visually_hidden_from_conversation === true) { skip("hidden_messages"); continue; }
        if (role !== "user" && role !== "assistant") { skip("non_dialogue_messages"); continue; }
        if (message.channel === "analysis" || (role === "assistant" && message.recipient != null && message.recipient !== "all")) { skip("internal_messages"); continue; }
        const parts: string[] = [];
        if (provider === "chatgpt") {
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
        } else if (Array.isArray(message.content)) {
          for (const value of message.content) {
            const block = row(value);
            if (block.type === "text" && typeof block.text === "string") parts.push(block.text);
            else if (block.type === "image" || block.type === "document") parts.push(`[${block.type === "image" ? "image" : "file"} not analyzed]`);
            else skip(["thinking", "tool_use", "tool_result", "injected_prompt_block"].includes(String(block.type)) ? String(block.type) : "unsupported_blocks");
          }
        } else if (message.content == null && typeof message.text === "string") parts.push(message.text);
        else throw new ConversationFormatError("Unsupported Claude message content.");
        if (Array.isArray(message.attachments) && message.attachments.length || Array.isArray(message.files) && message.files.length
          || Array.isArray(metadata.attachments) && metadata.attachments.length) { parts.push("[attachments not analyzed]"); skip("attachments"); }
        const cleaned = redactConversationText(parts.join("\n"));
        redactions += cleaned.redactions;
        if (!cleaned.text.trim()) continue;
        const start = text.length;
        text += `\n${role.toUpperCase()}\n${cleaned.text}\n`;
        messages.push({ id: node.id, role, text: cleaned.text, start, end: text.length,
          created_at: sourceTime(provider === "chatgpt" ? message.create_time : message.created_at) });
      }
      if (!messages.length) { empty++; continue; }
      // Pages are navigation offsets, never replacements for the full transcript.
      let start = 0;
      for (let i = 0; i < messages.length; i++) {
        const boundary = i + 1 < messages.length && messages[i + 1].role === "user";
        if (boundary && messages[i].end - start >= 20000) { pages.push({ start, end: messages[i].end }); start = messages[i].end; }
      }
      if (start < text.length) pages.push({ start, end: text.length });
      const created_at = sourceTime(provider === "chatgpt" ? record.create_time : record.created_at);
      const updated_at = sourceTime(provider === "chatgpt" ? record.update_time : record.updated_at);
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
      conversations.push({ id, provider, title: title.text, text, messages, created_at, updated_at, excluded, redactions, pages });
    } catch (error) {
      if (!(error instanceof ConversationFormatError)) throw error;
      rejected.push({ index, reason: error.message });
    }
  }
  return { conversations, rejected, empty, duplicates };
}
