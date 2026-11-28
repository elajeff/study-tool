"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { matchChatReferences, type ChatReferenceMatch } from "@/lib/chatbridge";
import { useState } from "react";
import JSZip from "jszip";
import { Download, FileUp } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cleanNotePath } from "@/lib/notes";
import { loadNotesForExport } from "@/lib/note-queries";
import { keepReviewedChoices, previewImport, readMarkdownFiles, type NoteImportChoices, type Vault, type VaultState } from "@/lib/obsidian";

type ImportedMarkdown = Awaited<ReturnType<typeof readMarkdownFiles>>;
type Preview = Pick<ImportedMarkdown, "files" | "blocked"> & {
  savedNotes: VaultState[];
  bindings: Record<string, string>;
  choices: NoteImportChoices;
  chatMatches: ChatReferenceMatch[];
};

export function NotesImporter({ vaults: initialVaults }: { vaults: Vault[] }) {
  const router = useRouter();
  const [vaults, setVaults] = useState(initialVaults);
  const [sourceId, setSourceId] = useState(initialVaults[0]?.id ?? "");
  const [name, setName] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [renamePath, setRenamePath] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const rows = preview ? previewImport(preview.files, preview.savedNotes, preview.bindings) : [];
  const warnings = new Map(preview?.files.map(file => [file.path, file.review]));
  const assigned = new Set(rows.map(row => row.previous?.artifact_id));
  const unresolved = rows.some((row) => row.identityConflict || !(preview?.choices[row.file.path] || row.decision));
  const canImport = vaults.some((vault) => vault.id === sourceId);

  async function loadState(paths: string[]) {
    const supabase = createClient();
    const state: VaultState[] = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await supabase.rpc("vault_import_state", { p_source_id: sourceId, p_paths: paths })
        .order("artifact_id").range(offset, offset + 499);
      if (error) throw new Error("Could not compare the files with your saved notes. Try the preview again.");
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
      setVaults([...vaults, data as Vault]); setSourceId(data.id); setName(""); setPreview(null);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not create vault."); }
    finally { setBusy(false); }
  }

  async function prepare(selected: FileList | null) {
    if (!selected?.length) return;
    setBusy(true); setMessage("Reading selected notes and archives…"); setPreview(null); setRenamePath("");
    try {
      const parsed = await readMarkdownFiles(Array.from(selected));
      setMessage("Checking saved notes for changes and conflicts…");
      const savedNotes = parsed.files.length ? await loadState(parsed.files.map(file => file.path)) : [];
      const chatMatches = await matchChatReferences(createClient(), parsed.chatReferences);
      setPreview({ files: parsed.files, blocked: parsed.blocked, savedNotes, bindings: {}, choices: {}, chatMatches });
      setMessage(`${parsed.files.length} ${parsed.files.length === 1 ? "file" : "files"} ready for preview.${parsed.skipped
        ? ` ${parsed.skipped} unsupported, generated, or oversized ${parsed.skipped === 1 ? "file" : "files"} skipped.` : ""}`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not preview files."); }
    finally { setBusy(false); }
  }

  async function bind(path: string, artifactId: string) {
    if (!preview) return;
    const { files, savedNotes, bindings, choices } = preview;
    setBusy(true); setMessage("");
    try {
      const next = { ...bindings, [path]: artifactId };
      previewImport(files, savedNotes, next);
      const paths = [...files.map((file) => file.path), ...Object.values(next).flatMap((id) => {
        const previous = savedNotes.find(row => row.artifact_id === id);
        return previous?.path ? [previous.path] : [];
      })];
      const state = await loadState(paths);
      const updatedRows = previewImport(files, state, next);
      setPreview({ ...preview, savedNotes: state, bindings: next, choices: keepReviewedChoices(choices, rows, updatedRows) });
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not reconcile this rename."); }
    finally { setBusy(false); }
  }

  async function accept() {
    if (!preview) return;
    setBusy(true); setMessage("Saving reviewed notes…");
    try {
      const entries = rows.map((row) => ({
        artifact_id: row.previous?.artifact_id ?? null, path: row.file.path, content: row.file.body,
        expected_path: row.previous?.path ?? null, expected_revision_id: row.previous?.revision_id ?? null,
        expected_note_hash: row.previous?.note_hash ?? null, decision: preview.choices[row.file.path] || row.decision,
      }));
      if (new Blob([JSON.stringify(entries)]).size > 35 * 1024 * 1024) throw new Error("The import exceeds 35 MiB of JSON. Select fewer files.");
      const { error } = await createClient().rpc("accept_obsidian_import", { p_source_id: sourceId, p_entries: entries });
      if (error) throw new Error(error.message);
      setPreview(null); setMessage(`${entries.length} notes saved. Open Library to include them in a snapshot.`); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Import could not be confirmed. Refresh before retrying."); }
    finally { setBusy(false); }
  }

  async function exportNotes() {
    setBusy(true); setMessage("");
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sign in again.");
      const notes = await loadNotesForExport(supabase, sourceId === "manual" ? null : sourceId || undefined);
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
    <h2>Import Obsidian notes</h2>
    <p>Choose the same vault when reimporting. Preview files before accepting them. Original files are not changed.</p>
    <div className="vault-controls">
      <div><label htmlFor="import-vault">Vault</label><select className="input" id="import-vault" value={sourceId} disabled={busy}
        onChange={(event) => { setSourceId(event.target.value); setPreview(null); setMessage(""); }}>
        <option value="">All notes (export only)</option><option value="manual">Manual notes (export only)</option>
        {vaults.map((vault) => <option value={vault.id} key={vault.id}>{vault.name}{vaults.some((other) => other.id !== vault.id && other.name === vault.name) ? ` (${vault.id})` : ""}{vault.kind === "legacy_notes" ? " (legacy snapshots)" : ""}</option>)}
      </select></div>
      <form onSubmit={createVault}><label htmlFor="vault-name">New vault name</label><div className="search-row">
        <input id="vault-name" className="input" value={name} onChange={(event) => setName(event.target.value)} required maxLength={160} disabled={busy} />
        <button className="button button-light" type="submit" disabled={busy}>Create vault</button>
      </div></form>
    </div>
    {!canImport && <p>Create or select a vault above to enable import.</p>}
    <div className="import-actions"><label className={`button button-dark ${busy || !canImport ? "disabled" : ""}`}>
      <FileUp size={17} /> Import Obsidian notes<input aria-label="Import Obsidian notes" type="file" multiple accept=".zip,.md,text/markdown" className="import-file"
        disabled={busy || !canImport} onChange={(event) => { void prepare(event.target.files); event.target.value = ""; }} /></label>
      </div>
    <p>Choose Markdown files or a ZIP of your vault, review the notes, then save them below.</p>
    <details className="import-export"><summary>Export saved notes</summary><p>
      <button className="button button-light" disabled={busy} type="button" onClick={() => void exportNotes()}><Download size={16} /> Export ZIP</button></p></details>
    {message && <p role="status" className="import-message">{message}</p>}
    {!!preview?.blocked.length && <details open><summary>Notes blocked by credential checks ({preview.blocked.length})</summary>
      <ul>{preview.blocked.map(file => <li key={file.path}>{file.path}: {file.message}</li>)}</ul>
    </details>}
    {!!preview?.chatMatches.length && <details><summary>Conversation references ({preview.chatMatches.length})</summary>
      <p>Provider URLs and IDs identify related saved chats. They do not prove equal text or branches. AI Chats files remain outside note imports; notes elsewhere are kept.</p>
      <ul>{preview.chatMatches.map(reference => <li key={reference.path}>{reference.path}: {reference.items.length === 0 ? "No saved conversation found" : <>
        {reference.items.length > 1 && "Multiple saved copies: "}{reference.items.map(item => <span key={item.reference}>
          {item.revisionId ? <Link href={`/sources/revisions/${item.revisionId}`}>{item.reference}</Link> : `${item.reference} (no saved revision)`}{" "}
        </span>)}
      </>}</li>)}</ul>
    </details>}
    {!!preview?.files.length && <div className="import-preview"><h3>Review notes ({rows.length})</h3>
      <p>Files missing from this import are not deleted. Confirm renames by selecting the existing note. Older imported notes may need review.</p>
      {rows.map((row) => <article className="import-row" key={row.file.path}>
        <strong>{row.file.path}</strong><span>{row.previous && row.previous.path !== row.file.path ? "Rename · " : ""}{row.status}</span>
        {(!row.previous || row.previous.path !== row.file.path) && preview.savedNotes.length > 0 && <>
          <button type="button" className="text-link" disabled={busy} aria-expanded={renamePath === row.file.path}
            onClick={() => setRenamePath(renamePath === row.file.path ? "" : row.file.path)}>Match a renamed note</button>
          {renamePath === row.file.path && <label>Saved note for {row.file.path}
            <select className="input" value={preview.bindings[row.file.path] ?? ""} disabled={busy}
              onChange={event => void bind(row.file.path, event.target.value)}>
              <option value="">New note</option>
              {preview.savedNotes.map(previous => <option value={previous.artifact_id} key={previous.artifact_id}
                disabled={assigned.has(previous.artifact_id) && row.previous?.artifact_id !== previous.artifact_id}>
                {previous.path ?? previous.artifact_id}
              </option>)}
            </select>
          </label>}
        </>}
        {warnings.get(row.file.path) && <p>{warnings.get(row.file.path)}</p>}
        {row.identityConflict && <p role="alert">This path is occupied. Select its existing artifact or rename the file before importing.</p>}
        {!row.identityConflict && row.decision === "" && <label>Decision for {row.file.path}
          <select className="input" value={preview.choices[row.file.path] ?? ""} disabled={busy}
            onChange={(event) => setPreview({ ...preview, choices: { ...preview.choices, [row.file.path]: event.target.value as "keep" | "replace" | "" } })}>
            <option value="">Choose an action</option><option value="keep">Keep current note / keep deleted</option>
            <option value="replace">Replace or restore from import</option>
          </select></label>}
        <details><summary>Review text for {row.file.path}</summary>
          <h4>Current editable note</h4><pre>{row.previous?.note_body ?? "No editable note."}</pre>
          <h4>Incoming file</h4><pre>{row.file.body}</pre>
        </details>
      </article>)}
      <div className="import-save" aria-label="Save Obsidian import"><div><h3>Save notes to your vault</h3><p>{rows.length} notes · {vaults.find(vault => vault.id === sourceId)?.name}</p>
        {!!unresolved && <p>Resolve the marked conflicts before saving.</p>}</div><div className="import-actions"><button className="button button-dark" disabled={busy || unresolved} type="button" onClick={() => void accept()}>{busy ? "Saving…" : "Save notes to vault"}</button>
        <button className="button button-light" disabled={busy} type="button" onClick={() => { setPreview(null); setMessage(""); }}>Cancel preview</button></div>
      </div>
    </div>}
  </section>;
}
