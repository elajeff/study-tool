"use client";
import { useState } from "react";
import JSZip from "jszip";
import { Download, FileUp } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cleanNotePath } from "@/lib/notes";
import { loadNotes } from "@/lib/note-queries";
import { previewImport, readMarkdownFiles, type Vault, type VaultState } from "@/lib/obsidian";
import type { ImportFile } from "@/lib/import-files";

export function NotesImporter({ vaults: initialVaults }: { vaults: Vault[] }) {
  const [vaults, setVaults] = useState(initialVaults);
  const [sourceId, setSourceId] = useState(initialVaults[0]?.id ?? "");
  const [name, setName] = useState("");
  const [files, setFiles] = useState<ImportFile[]>([]);
  const [vaultState, setVaultState] = useState<VaultState[]>([]);
  const [bindings, setBindings] = useState<Record<string, string>>({});
  const [choices, setChoices] = useState<Record<string, "keep" | "replace" | "">>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const rows = previewImport(files, vaultState, bindings);
  const unresolved = rows.some((row) => row.identityConflict || !(choices[row.file.path] || row.decision));
  const canImport = vaults.some((vault) => vault.id === sourceId);

  async function loadState(paths: string[]) {
    const supabase = createClient();
    const state: VaultState[] = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await supabase.rpc("vault_import_state", { p_source_id: sourceId, p_paths: paths })
        .order("artifact_id").range(offset, offset + 499);
      if (error) throw new Error("Could not preview this vault. Check that migration 004 was applied.");
      state.push(...data as VaultState[]);
      if (data.length < 500) return state;
    }
  }

  async function createVault(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true); setMessage("");
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sign in again.");
      const { data, error } = await supabase.from("sources").insert({ user_id: user.id, kind: "obsidian", name: name.trim() })
        .select("id,name,kind").single();
      if (error) throw new Error("Could not create this vault. Enter a name between 1 and 160 characters.");
      setVaults([...vaults, data as Vault]); setSourceId(data.id); setName(""); setFiles([]);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not create vault."); }
    finally { setBusy(false); }
  }

  async function prepare(selected: FileList | null) {
    if (!selected?.length) return;
    setBusy(true); setMessage(""); setFiles([]);
    try {
      const parsed = await readMarkdownFiles(Array.from(selected));
      const state = await loadState(parsed.files.map((file) => file.path));
      setVaultState(state); setBindings({}); setChoices({}); setFiles(parsed.files);
      setMessage(`${parsed.files.length} ${parsed.files.length === 1 ? "file" : "files"} ready for preview.${parsed.skipped
        ? ` ${parsed.skipped} unsupported, generated, or oversized ${parsed.skipped === 1 ? "file" : "files"} skipped.` : ""}`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not preview files."); }
    finally { setBusy(false); }
  }

  async function bind(path: string, artifactId: string) {
    setBusy(true); setMessage("");
    try {
      const next = { ...bindings, [path]: artifactId };
      previewImport(files, vaultState, next);
      const paths = [...files.map((file) => file.path), ...Object.values(next).flatMap((id) => {
        const previous = vaultState.find((row) => row.artifact_id === id);
        return previous?.path ? [previous.path] : [];
      })];
      const state = await loadState(paths);
      previewImport(files, state, next);
      setVaultState(state); setBindings(next); setChoices({});
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not reconcile this rename."); }
    finally { setBusy(false); }
  }

  async function accept() {
    setBusy(true); setMessage("");
    try {
      const entries = rows.map((row) => ({
        artifact_id: row.previous?.artifact_id ?? null, path: row.file.path, content: row.file.body,
        expected_path: row.previous?.path ?? null, expected_revision_id: row.previous?.revision_id ?? null,
        expected_note_hash: row.previous?.note_hash ?? null, decision: choices[row.file.path] || row.decision,
      }));
      if (new Blob([JSON.stringify(entries)]).size > 35 * 1024 * 1024) throw new Error("The import exceeds 35 MiB of JSON. Select fewer files.");
      const { error } = await createClient().rpc("accept_obsidian_import", { p_source_id: sourceId, p_entries: entries });
      if (error) throw new Error(error.message);
      window.location.reload();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Import could not be confirmed. Refresh before retrying."); }
    finally { setBusy(false); }
  }

  async function exportNotes() {
    setBusy(true); setMessage("");
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sign in again.");
      const notes = await loadNotes(supabase, sourceId === "manual" ? null : sourceId || undefined);
      const zip = new JSZip();
      const seen = new Set<string>();
      for (const note of notes) {
        const path = cleanNotePath(note.path);
        if (!path) throw new Error(`Cannot export invalid path: ${note.path}`);
        const target = sourceId ? path : `${note.source_id ?? "manual"}/${path}`;
        if (seen.has(target.toLowerCase())) throw new Error(`Conflicting export path: ${path}`);
        seen.add(target.toLowerCase()); zip.file(target, note.body);
      }
      const url = URL.createObjectURL(await zip.generateAsync({ type: "blob" }));
      const link = document.createElement("a");
      link.href = url; link.download = "study-tool-notes.zip"; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Export failed."); }
    finally { setBusy(false); }
  }

  return <section className="panel vault-import">
    <h2>Import notes</h2>
    <p>Choose the same vault when reimporting. Preview files before accepting them. Original files are not changed.</p>
    <div className="vault-controls">
      <div><label htmlFor="import-vault">Vault</label><select className="input" id="import-vault" value={sourceId} disabled={busy}
        onChange={(event) => { setSourceId(event.target.value); setFiles([]); setMessage(""); }}>
        <option value="">All notes (export only)</option><option value="manual">Manual notes (export only)</option>
        {vaults.map((vault) => <option value={vault.id} key={vault.id}>{vault.name}{vaults.some((other) => other.id !== vault.id && other.name === vault.name) ? ` (${vault.id})` : ""}{vault.kind === "legacy_notes" ? " (legacy snapshots)" : ""}</option>)}
      </select></div>
      <form onSubmit={createVault}><label htmlFor="vault-name">New vault name</label><div className="search-row">
        <input id="vault-name" className="input" value={name} onChange={(event) => setName(event.target.value)} required maxLength={160} disabled={busy} />
        <button className="button button-light" type="submit" disabled={busy}>Create vault</button>
      </div></form>
    </div>
    <div className="import-actions"><label className={`button button-dark ${busy || !canImport ? "disabled" : ""}`}>
      <FileUp size={17} /> Preview Markdown<input type="file" multiple accept=".zip,.md,text/markdown" className="import-file"
        disabled={busy || !canImport} onChange={(event) => { void prepare(event.target.files); event.target.value = ""; }} /></label>
      <button className="button button-light" disabled={busy} type="button" onClick={() => void exportNotes()}><Download size={16} /> Export ZIP</button></div>
    {message && <p role="status" className="import-message">{message}</p>}
    {files.length > 0 && <div className="import-preview"><h3>Preview ({rows.length})</h3>
      <p>Files missing from this import are not deleted. Confirm renames by selecting the existing note. Older imported notes may need review.</p>
      {rows.map((row) => <article className="import-row" key={row.file.path}>
        <strong>{row.file.path}</strong><span>{row.previous && row.previous.path !== row.file.path ? "Rename · " : ""}{row.status}</span>
        {(!row.previous || row.previous.path !== row.file.path) && <label>Identity for {row.file.path}
          <select className="input" value={bindings[row.file.path] ?? ""} disabled={busy}
            onChange={(event) => void bind(row.file.path, event.target.value)}>
            <option value="">New artifact</option>
            {vaultState.map((previous) => <option value={previous.artifact_id} key={previous.artifact_id}
              disabled={rows.some((other) => other.file.path !== row.file.path && other.previous?.artifact_id === previous.artifact_id)}>
              Rename {previous.path ?? previous.artifact_id}
            </option>)}
          </select></label>}
        {row.identityConflict && <p role="alert">This path is occupied. Select its existing artifact or rename the file before importing.</p>}
        {!row.identityConflict && row.decision === "" && <label>Decision for {row.file.path}
          <select className="input" value={choices[row.file.path] ?? ""} disabled={busy}
            onChange={(event) => setChoices({ ...choices, [row.file.path]: event.target.value as "keep" | "replace" | "" })}>
            <option value="">Choose an action</option><option value="keep">Keep current note / keep deleted</option>
            <option value="replace">Replace or restore from import</option>
          </select></label>}
        <details><summary>Review text for {row.file.path}</summary>
          <h4>Current editable note</h4><pre>{row.previous?.note_body ?? "No editable note."}</pre>
          <h4>Incoming file</h4><pre>{row.file.body}</pre>
        </details>
      </article>)}
      <div className="import-actions"><button className="button button-dark" disabled={busy || unresolved} type="button" onClick={() => void accept()}>Accept import</button>
        <button className="button button-light" disabled={busy} type="button" onClick={() => { setFiles([]); setMessage(""); }}>Cancel preview</button></div>
    </div>}
  </section>;
}
