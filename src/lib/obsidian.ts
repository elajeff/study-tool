import JSZip from "jszip";
import { cleanNotePath, shouldImportNote, vaultRoot } from "./notes.ts";

export type Vault = { id: string; name: string; kind: "obsidian" | "legacy_notes" };
export type ImportFile = { path: string; body: string; hash: string };
export type VaultState = {
  artifact_id: string;
  path: string | null;
  revision_id: string;
  baseline_hash: string | null;
  note_id: string | null;
  note_hash: string | null;
  note_body: string | null;
};
export type ImportPreview = {
  file: ImportFile;
  previous: VaultState | undefined;
  status: string;
  decision: "keep" | "replace" | "";
  identityConflict: boolean;
};

export async function textHash(body: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function readZipText(entry: JSZip.JSZipObject): Promise<string | null> {
  // JSZip documents internalStream, but its bundled ZipObject type omits it.
  const stream = (entry as JSZip.JSZipObject & {
    internalStream(type: "uint8array"): JSZip.JSZipStreamHelper<Uint8Array>;
  }).internalStream("uint8array");
  return new Promise((resolve, reject) => {
    const decoder = new TextDecoder("utf-8", { ignoreBOM: true });
    let bytes = 0;
    let body = "";
    let oversized = false;
    stream.on("data", (chunk) => {
      if (oversized) return;
      bytes += chunk.byteLength;
      if (bytes > 500000) {
        oversized = true;
        stream.pause();
        resolve(null);
      } else body += decoder.decode(chunk, { stream: true });
    }).on("error", reject).on("end", () => resolve(body + decoder.decode())).resume();
  });
}

export async function readMarkdownFiles(selected: File[]) {
  const files: ImportFile[] = [];
  let skipped = 0;
  let total = 0;
  const paths = new Set<string>();
  const plain = selected.filter((file) => !file.name.toLowerCase().endsWith(".zip"));
  const plainRoot = vaultRoot(plain.map((file) => file.webkitRelativePath || file.name));
  async function add(raw: string, bytes: number, read: () => Promise<string | null>) {
    const path = cleanNotePath(raw);
    if (!path || !shouldImportNote(path) || bytes > 500000) { skipped++; return; }
    const body = await read();
    if (body === null) { skipped++; return; }
    const bodyBytes = new Blob([body]).size;
    total += bodyBytes;
    if (total > 35 * 1024 * 1024) throw new Error("The selected notes exceed 35 MiB. Select fewer files.");
    if (body.includes("\0")) throw new Error(`${path} contains unsupported binary text.`);
    if (bodyBytes > 500000) { skipped++; return; }
    if (paths.has(path.toLowerCase())) throw new Error(`Duplicate path: ${path}. Select files from one vault.`);
    paths.add(path.toLowerCase());
    files.push({ path, body, hash: await textHash(body) });
    if (files.length > 2000) throw new Error("Import at most 2000 notes at a time.");
  }
  for (const file of selected) {
    if (file.name.toLowerCase().endsWith(".zip")) {
      if (file.size > 20 * 1024 * 1024) throw new Error("A ZIP exceeds the 20 MiB import limit.");
      const zip = await JSZip.loadAsync(file);
      if (Object.keys(zip.files).length > 4000) throw new Error("The archive contains too many files.");
      const names = Object.values(zip.files).map((entry) => entry.unsafeOriginalName ?? entry.name);
      const root = vaultRoot(names.filter((name) => cleanNotePath(name)));
      for (const entry of Object.values(zip.files)) {
        if (entry.dir) continue;
        const raw = entry.unsafeOriginalName ?? entry.name;
        if (!cleanNotePath(raw)) { skipped++; continue; }
        await add(root ? raw.slice(root.length + 1) : raw, 0, () => readZipText(entry));
      }
    } else {
      const raw = file.webkitRelativePath || file.name;
      await add(plainRoot ? raw.slice(plainRoot.length + 1) : raw, file.size, () => file.text());
    }
  }
  if (!files.length) throw new Error("No supported Markdown files were found.");
  return { files, skipped };
}

export function previewImport(files: ImportFile[], state: VaultState[], bindings: Record<string, string> = {}): ImportPreview[] {
  const used = new Set<string>();
  return files.map((file) => {
    const previous = bindings[file.path]
      ? state.find((row) => row.artifact_id === bindings[file.path])
      : state.find((row) => row.path === file.path);
    if (bindings[file.path] && !previous) throw new Error("The selected artifact is no longer in this vault.");
    if (previous && used.has(previous.artifact_id)) throw new Error("Two files cannot use the same artifact. Review the rename choices.");
    if (previous) used.add(previous.artifact_id);
    const occupied = state.some((row) => row.path?.toLowerCase() === file.path.toLowerCase() && row.artifact_id !== previous?.artifact_id);
    if (occupied) return { file, previous, status: "Path conflict", decision: "", identityConflict: true };
    let status: string;
    let decision: ImportPreview["decision"];
    if (!previous) { status = "New"; decision = "replace"; }
    else if (previous.note_hash === file.hash) {
      status = previous.baseline_hash === file.hash ? "Unchanged" : "Matches current note";
      decision = "keep";
    } else if (previous.note_id === null) { status = "Deleted locally"; decision = ""; }
    else if (previous.baseline_hash === null) { status = "Needs review"; decision = ""; }
    else if (previous.baseline_hash === file.hash) { status = "Local edits kept"; decision = "keep"; }
    else if (previous.baseline_hash === previous.note_hash) { status = "Update"; decision = "replace"; }
    else { status = "Conflict"; decision = ""; }
    return { file, previous, status, decision, identityConflict: false };
  });
}
