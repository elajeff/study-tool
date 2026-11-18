import JSZip from "jszip";

export type ImportFile = { path: string; body: string; hash: string };

function cleanSourcePath(raw: string): string | null {
  const path = raw.replaceAll("\\", "/");
  if (!path || /^\/|^[a-z]:/i.test(path) || /[\x00-\x1f\x7f]/.test(path)
    || new TextEncoder().encode(path).length > 1024 || path.split("/").some((part) => !part || part === "." || part === "..")) return null;
  return path;
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

export async function readImportFiles(selected: File[], include: (path: string) => boolean, findRoot?: (paths: string[]) => string | null) {
  const files: ImportFile[] = [];
  const skipped: string[] = [];
  let total = 0;
  const paths = new Set<string>();
  const plain = selected.filter((file) => !file.name.toLowerCase().endsWith(".zip"));
  const plainRoot = findRoot?.(plain.map((file) => file.webkitRelativePath || file.name));
  async function add(raw: string, bytes: number, read: () => Promise<string | null>) {
    const path = cleanSourcePath(raw);
    if (!path || !include(path) || bytes > 500000) { skipped.push(raw); return; }
    const body = await read();
    if (body === null) { skipped.push(path); return; }
    const bodyBytes = new Blob([body]).size;
    total += bodyBytes;
    if (total > 35 * 1024 * 1024) throw new Error("The selected files exceed 35 MiB. Select fewer files.");
    if (body.includes("\0")) throw new Error(`${path} contains unsupported binary text.`);
    if (bodyBytes > 500000) { skipped.push(path); return; }
    if (paths.has(path.toLowerCase())) throw new Error(`Duplicate path: ${path}. Select files from one source.`);
    paths.add(path.toLowerCase());
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body));
    const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
    files.push({ path, body, hash });
    if (files.length > 2000) throw new Error("Import at most 2000 files at a time.");
  }
  for (const file of selected) {
    try {
      if (file.name.toLowerCase().endsWith(".zip")) {
        if (file.size > 20 * 1024 * 1024) throw new Error("A ZIP exceeds the 20 MiB import limit.");
        const zip = await JSZip.loadAsync(file);
        if (Object.keys(zip.files).length > 4000) throw new Error("The archive contains too many files.");
        const names = Object.values(zip.files).map((entry) => entry.unsafeOriginalName ?? entry.name);
        const root = findRoot?.(names.filter((name) => cleanSourcePath(name)));
        for (const entry of Object.values(zip.files)) {
          if (entry.dir) continue;
          const raw = entry.unsafeOriginalName ?? entry.name;
          if (!cleanSourcePath(raw)) { skipped.push(raw); continue; }
          await add(root && raw.startsWith(`${root}/`) ? raw.slice(root.length + 1) : raw, 0, () => readZipText(entry));
        }
      } else {
        const raw = file.webkitRelativePath || file.name;
        await add(plainRoot && raw.startsWith(`${plainRoot}/`) ? raw.slice(plainRoot.length + 1) : raw, file.size, () => file.text());
      }
    } catch (error) {
      throw new Error(`${file.name}: ${error instanceof Error ? error.message : "Could not read this file."}`);
    }
  }
  if (!files.length) throw new Error("No supported text files were found.");
  return { files, skipped };
}

export function matchImportFiles<T extends { artifact_id: string; path: string | null }>(files: ImportFile[], state: T[], bindings: Record<string, string> = {}) {
  const used = new Set<string>();
  return files.map((file) => {
    const previous = bindings[file.path]
      ? state.find((row) => row.artifact_id === bindings[file.path])
      : state.find((row) => row.path === file.path);
    if (bindings[file.path] && !previous) throw new Error("The selected file is no longer in this source.");
    if (previous && used.has(previous.artifact_id)) throw new Error("Two files cannot use the same artifact. Review the rename choices.");
    if (previous) used.add(previous.artifact_id);
    const identityConflict = state.some((row) => row.path?.toLowerCase() === file.path.toLowerCase() && row.artifact_id !== previous?.artifact_id);
    return { file, previous, identityConflict };
  });
}
