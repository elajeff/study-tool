export type InboxKind = "course" | "module" | "digest" | "evidence";
export type InboxBlock = { kind: InboxKind; value: Record<string, unknown> };
const formats = new Map<string, InboxKind>([["study-course/1", "course"], ["study-module/1", "module"], ["study-digest/1", "digest"], ["study-evidence/1", "evidence"]]);

// Remove trailing commas only outside strings; code examples and quoted punctuation stay intact.
function parseJson(raw: string): unknown {
  let clean = "", quoted = false, escaped = false;
  for (let i = 0; i < raw.length; i++) {
    const character = raw[i];
    if (!quoted && character === ",") {
      let next = i + 1;
      while (next < raw.length && /\s/.test(raw[next])) next++;
      if (raw[next] === "}" || raw[next] === "]") continue;
    }
    clean += character;
    if (quoted) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') quoted = false;
    } else if (character === '"') quoted = true;
  }
  return JSON.parse(clean);
}

export function parseInbox(raw: string): { blocks: InboxBlock[]; ignored: number } {
  if (new TextEncoder().encode(raw).length > 1024 * 1024) throw new Error("Import at most 1 MiB of response text.");
  const blocks: InboxBlock[] = [];
  let ignored = 0;
  function add(body: string, label = "") {
    const explicit = label.startsWith("study-");
    let value: unknown;
    try { value = parseJson(body); }
    catch { if (explicit || /"format"\s*:\s*"study-/.test(body)) throw new Error("A Study Tool block is incomplete or invalid JSON. Nothing was saved."); ignored++; return; }
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      if (explicit) throw new Error("A Study Tool block must contain a JSON object. Nothing was saved.");
      ignored++; return;
    }
    const record = value as Record<string, unknown>;
    const kind = typeof record.format === "string" ? formats.get(record.format)
      : label === "study-evidence" || (record.topic !== undefined && record.level !== undefined && record.evidence !== undefined) ? "evidence" : undefined;
    if (!kind) {
      if (explicit || (typeof record.format === "string" && record.format.startsWith("study-")))
        throw new Error("Unsupported or missing Study Tool format. Nothing was saved.");
      ignored++; return;
    }
    if (explicit && label !== `study-${kind}`) throw new Error("A block's fence label disagrees with its JSON format.");
    blocks.push({ kind, value: record });
    if (blocks.length > 20) throw new Error("Import at most 20 Study Tool blocks at once.");
  }
  if (raw.trimStart().startsWith("{")) add(raw);
  else {
    let fence: { marker: string; label: string; lines: string[] } | null = null;
    for (const line of raw.split(/\r?\n/)) {
      if (fence) {
        const close = line.match(/^ {0,3}(`{3,}|~{3,})\s*$/);
        if (close && close[1][0] === fence.marker[0] && close[1].length >= fence.marker.length) {
          if (fence.label === "json" || fence.label.startsWith("study-")) add(fence.lines.join("\n"), fence.label);
          fence = null;
        } else fence.lines.push(line);
      } else {
        const open = line.match(/^ {0,3}(`{3,}|~{3,})\s*([^\s]*)\s*$/);
        if (open) fence = { marker: open[1], label: open[2], lines: [] };
      }
    }
    if (fence && (fence.label.startsWith("study-") || /"format"\s*:\s*"study-/.test(fence.lines.join("\n"))))
      throw new Error("A Study Tool fence is not closed. Nothing was saved.");
  }
  if (!blocks.length) throw new Error("No supported blocks found. Paste course, module, digest or assessment JSON from Study Tool instructions.");
  return { blocks, ignored };
}
