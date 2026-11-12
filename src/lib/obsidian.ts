import { cleanNotePath, shouldImportNote, vaultRoot } from "./notes.ts";
import { readImportFiles, matchImportFiles, type ImportFile } from "./import-files.ts";

export type Vault = { id: string; name: string; kind: "obsidian" | "legacy_notes" };
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

export async function readMarkdownFiles(selected: File[]) {
  // Non-Markdown archive metadata must not change vault-root detection.
  const result = await readImportFiles(selected, shouldImportNote, (paths) => vaultRoot(paths.filter((path) => cleanNotePath(path))));
  return { files: result.files, skipped: result.skipped.length };
}

export function previewImport(files: ImportFile[], state: VaultState[], bindings: Record<string, string> = {}): ImportPreview[] {
  return matchImportFiles(files, state, bindings).map(({ file, previous, identityConflict }) => {
    if (identityConflict) return { file, previous, status: "Path conflict", decision: "", identityConflict: true };
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
