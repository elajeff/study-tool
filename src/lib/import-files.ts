import JSZip from "jszip";

export type ImportFile = { path: string; body: string; hash: string };

function cleanSourcePath(raw: string): string | null {
  const path = raw.replaceAll("\\", "/");
  if (!path || /^\/|^[a-z]:/i.test(path) || /[\x00-\x1f\x7f]/.test(path)
    || new TextEncoder().encode(path).length > 1024 || path.split("/").some((part) => !part || part === "." || part === "..")) return null;
  return path;
}

function readZipText(entry: JSZip.JSZipObject, prefixBytes?: number): Promise<string | null> {
  // JSZip documents internalStream, but its bundled ZipObject type omits it.
  const stream = (entry as JSZip.JSZipObject & {
    internalStream(type: "uint8array"): JSZip.JSZipStreamHelper<Uint8Array>;
  }).internalStream("uint8array");
  return new Promise((resolve, reject) => {
    const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
    let bytes = 0;
    let body = "";
    let stopped = false;
    stream.on("data", (chunk) => {
      if (stopped) return;
      if (prefixBytes !== undefined && bytes + chunk.byteLength >= prefixBytes) {
        stopped = true;
        stream.pause();
        try { resolve(body + decoder.decode(chunk.subarray(0, prefixBytes - bytes), { stream: true })); }
        catch (error) { reject(error); }
        return;
      }
      bytes += chunk.byteLength;
      if (bytes > 500000) {
        stopped = true;
        stream.pause();
        resolve(null);
      } else {
        try { body += decoder.decode(chunk, { stream: true }); }
        catch (error) { stream.pause(); reject(error); }
      }
    }).on("error", reject).on("end", () => {
      try { resolve(body + decoder.decode()); }
      catch (error) { reject(error); }
    }).resume();
  });
}

export async function readImportFiles(selected: File[], include: (path: string) => boolean | "optional", findRoot?: (paths: string[], directories: string[]) => string | null,
  inspectExcluded?: (path: string, readPrefix: (bytes: number) => Promise<string | null>) => Promise<void>) {
  const files: ImportFile[] = [];
  const skipped: string[] = [];
  let total = 0;
  const paths = new Set<string>();
  const extraFiles: (() => Promise<void>)[] = [];
  type ReadFile = (prefixBytes?: number) => Promise<string | null>;

  async function queueFile(raw: string, bytes: number, read: ReadFile) {
    const path = cleanSourcePath(raw);
    if (!path) { skipped.push(raw); return; }
    const kind = include(path);
    if (!kind) {
      await inspectExcluded?.(path, read);
      skipped.push(raw);
    } else if (kind === "optional") {
      extraFiles.push(() => add(path, bytes, read, true));
    } else {
      await add(path, bytes, read, false);
    }
  }

  async function add(path: string, bytes: number, read: ReadFile, optional: boolean) {
    if (optional && (files.length >= 2000 || paths.has(path.toLowerCase()))) { skipped.push(path); return; }
    if (bytes > 500000) { skipped.push(path); return; }
    let body;
    try { body = await read(); }
    catch (error) {
      if (!(error instanceof TypeError)) throw error;
      if (optional) { skipped.push(path); return; }
      throw new Error(`${path} is not valid UTF-8. Save it as UTF-8 and import it again.`);
    }
    if (body === null) { skipped.push(path); return; }
    if (optional && /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(body)) { skipped.push(path); return; }
    const bodyBytes = new Blob([body]).size;
    if (total + bodyBytes > 35 * 1024 * 1024) {
      if (optional) { skipped.push(path); return; }
      throw new Error("The selected files exceed 35 MiB. Select fewer files.");
    }
    total += bodyBytes;
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
        const entries = Object.values(zip.files);
        const directories: string[] = [];
        const filePaths: string[] = [];
        for (const entry of entries) {
          const path = cleanSourcePath(entry.dir ? entry.name.replace(/\/$/, "") : entry.unsafeOriginalName ?? entry.name);
          if (path) (entry.dir ? directories : filePaths).push(path);
        }
        const root = findRoot?.(filePaths, directories);
        for (const entry of entries) {
          if (entry.dir) continue;
          const raw = entry.unsafeOriginalName ?? entry.name;
          const path = cleanSourcePath(raw);
          if (!path || (root && !path.startsWith(`${root}/`))) { skipped.push(raw); continue; }
          await queueFile(root ? path.slice(root.length + 1) : path, 0, (prefixBytes) => readZipText(entry, prefixBytes));
        }
      } else {
        const raw = file.webkitRelativePath || file.name;
        await queueFile(raw, file.size, async (prefixBytes) => {
          const input = prefixBytes === undefined ? file : file.slice(0, prefixBytes);
          return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(await input.arrayBuffer(), { stream: input.size < file.size });
        });
      }
    } catch (error) {
      throw new Error(`${file.name}: ${error instanceof Error ? error.message : "Could not read this file."}`);
    }
  }
  for (const extra of extraFiles) await extra();
  if (!files.length && !inspectExcluded) throw new Error("No supported text files were found.");
  return { files, skipped };
}

export function matchImportFiles<T extends { artifact_id: string; path: string | null }>(files: ImportFile[], state: T[], bindings: Record<string, string> = {}) {
  const byId = new Map(state.map(row => [row.artifact_id, row]));
  const byPath = new Map<string, T>();
  const byLowerPath = new Map<string, T[]>();
  for (const row of state) {
    if (row.path === null) continue;
    byPath.set(row.path, row);
    const key = row.path.toLowerCase();
    const matches = byLowerPath.get(key) ?? [];
    matches.push(row);
    byLowerPath.set(key, matches);
  }
  const used = new Set<string>();
  return files.map((file) => {
    const binding = Object.hasOwn(bindings, file.path) ? bindings[file.path] : undefined;
    const previous = binding ? byId.get(binding) : byPath.get(file.path);
    if (binding && !previous) throw new Error("The selected file is no longer in this source.");
    if (previous && used.has(previous.artifact_id)) throw new Error("Two files cannot use the same artifact. Review the rename choices.");
    if (previous) used.add(previous.artifact_id);
    const matches = byLowerPath.get(file.path.toLowerCase()) ?? [];
    const identityConflict = matches.some(row => row.artifact_id !== previous?.artifact_id);
    return { file, previous, identityConflict };
  });
}
