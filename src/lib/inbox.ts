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

export type ModuleImportScope = { courseId: string; moduleId: string } | { courseId: string; moduleIds: string[] };

export function parseInbox(raw: string, expected?: ModuleImportScope): { blocks: InboxBlock[]; ignored: number } {
  if (new TextEncoder().encode(raw).length > 1024 * 1024) throw new Error("Import at most 1 MiB of response text.");
  const blocks: InboxBlock[] = [];
  const batch = expected && "moduleIds" in expected ? expected : null;
  let ignored = 0;
  function append(kind: InboxKind, value: Record<string, unknown>) {
    blocks.push({ kind, value });
    if (blocks.length > 20) throw new Error("Import at most 20 Study Tool blocks at once.");
  }
  function add(body: string, label = "") {
    const explicit = label.startsWith("study-");
    let value: unknown;
    try { value = parseJson(body); }
    catch { if (explicit || /"format"\s*:\s*"study-/.test(body)) throw new Error("A Study Tool block is incomplete or invalid JSON. Nothing was saved."); ignored++; return; }
    if (!explicit && Array.isArray(value) && (batch || value.some(item => item?.format === "study-module/1"))) {
      if (!value.length || value.some(item => item?.format !== "study-module/1")) throw new Error("A lesson-plan batch must contain only study-module objects.");
      for (const item of value) append("module", item);
      return;
    }
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
    append(kind, record);
  }
  const start = raw.trimStart();
  if (start.startsWith("{") || /^\[\s*(?:\{|\])/.test(start)) add(raw);
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
  if (batch) {
    const seen = new Set<string>();
    for (const block of blocks) {
      const id = block.value.module;
      if (block.kind !== "module" || block.value.course_id !== batch.courseId || typeof id !== "string" || !batch.moduleIds.includes(id))
        throw new Error("The batch contains a plan or response for a different course or module.");
      if (seen.has(id)) throw new Error(`The batch contains more than one plan for ${id}.`);
      seen.add(id);
    }
    const missing = batch.moduleIds.filter(id => !seen.has(id));
    if (missing.length) throw new Error(`Missing plans for ${missing.join(", ")}. Ask ChatGPT to return the complete batch.`);
  } else if (expected && "moduleId" in expected) {
    const plan = blocks.find(block => block.kind === "module");
    if (!plan || blocks.some(block => block.kind === "module"
      ? block.value.course_id !== expected.courseId || block.value.module !== expected.moduleId
      : block.kind !== "digest" || block.value.export_id !== plan.value.export_id))
      throw new Error("Choose the lesson-plan file for this course and module. Nothing was saved. Other responses can be imported in Inbox.");
  }
  return { blocks, ignored };
}
