"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { readImportFiles, type ImportFile } from "@/lib/import-files";
import { inspectRepositoryText, previewRepository, shouldImportRepositoryFile, type RepositoryFile } from "@/lib/repository-import";
import { loadRepositoryFiles } from "@/lib/source-queries";

type Repository = { id: string; name: string };
type ReviewedFile = ImportFile & ReturnType<typeof inspectRepositoryText>;

export function RepositoryImporter({ repositories, sourceId }: { repositories: Repository[]; sourceId: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [files, setFiles] = useState<ReviewedFile[]>([]);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [selected, setSelected] = useState(new Set<string>());
  const [state, setState] = useState<RepositoryFile[]>([]);
  const [bindings, setBindings] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const rows = previewRepository(files.filter((file) => selected.has(file.path)), state, bindings);

  async function createRepository(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sign in again.");
      const { data, error } = await supabase.from("sources").insert({ user_id: user.id, kind: "repository", name: name.trim() }).select("id").single();
      if (error) throw new Error("Could not create repository. Enter a name between 1 and 160 characters.");
      router.push(`/repositories?source=${data.id}`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not create repository."); }
    finally { setBusy(false); }
  }

  async function prepare(file: File | undefined) {
    if (!file) return;
    setBusy(true); setMessage(""); setFiles([]); setSkipped([]);
    try {
      if (!file.name.toLowerCase().endsWith(".zip")) throw new Error("Select a ZIP archive.");
      const parsed = await readImportFiles([file], shouldImportRepositoryFile);
      const current = await loadRepositoryFiles(createClient(), sourceId);
      const reviewed = parsed.files.map((file) => ({ ...file, ...inspectRepositoryText(file.body) }));
      setState(current); setBindings({}); setFiles(reviewed); setSkipped(parsed.skipped);
      setSelected(new Set(reviewed.filter((file) => !file.blocked).map((file) => file.path)));
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not preview the archive."); }
    finally { setBusy(false); }
  }

  function toggle(path: string) {
    const next = new Set(selected);
    if (next.has(path)) next.delete(path); else next.add(path);
    try {
      previewRepository(files.filter((file) => next.has(file.path)), state, bindings);
      setSelected(next); setMessage("");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Review the file identities."); }
  }

  function bind(path: string, artifactId: string) {
    const next = { ...bindings, [path]: artifactId };
    try {
      previewRepository(files.filter((file) => selected.has(file.path)), state, next);
      setBindings(next); setMessage("");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Review the rename choices."); }
  }

  async function accept() {
    setBusy(true); setMessage("");
    try {
      if (!rows.length || rows.some((row) => row.identityConflict)) throw new Error("Select files and resolve conflicts before importing.");
      const entries = rows.map((row) => ({ artifact_id: row.previous?.artifact_id ?? null, path: row.file.path, content: row.file.body,
        expected_path: row.previous?.path ?? null, expected_revision_id: row.previous?.revision_id ?? null }));
      if (new Blob([JSON.stringify(entries)]).size > 35 * 1024 * 1024) throw new Error("The import exceeds 35 MiB of JSON. Select fewer files.");
      const { error } = await createClient().rpc("accept_source_import", { p_source_id: sourceId, p_entries: entries });
      if (error) throw new Error(error.message);
      setFiles([]); setSkipped([]); setMessage("Import accepted."); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Import could not be confirmed. Select the ZIP again before retrying."); }
    finally { setBusy(false); }
  }

  return <section className="panel vault-import"><h2>Import repository</h2>
    <p>Reuse the same repository when reimporting. ZIP paths are kept as stored, including enclosing folders. Files are never executed.</p>
    <div className="vault-controls"><div><label htmlFor="repository-source">Repository</label>
      <select id="repository-source" className="input" value={sourceId} disabled={busy} onChange={(event) => {
        setBusy(true); setFiles([]); setSkipped([]); router.push(`/repositories?source=${event.target.value}`);
      }}>
        {!repositories.length && <option value="">Create a repository first</option>}
        {repositories.map((repository) => <option key={repository.id} value={repository.id}>{repository.name}{repositories.some((other) => other.id !== repository.id && other.name === repository.name) ? ` (${repository.id})` : ""}</option>)}
      </select></div>
      <form onSubmit={createRepository}><label htmlFor="repository-name">New repository name</label><div className="search-row">
        <input id="repository-name" className="input" value={name} onChange={(event) => setName(event.target.value)} required maxLength={160} disabled={busy} />
        <button className="button button-light" disabled={busy}>Create repository</button>
      </div></form></div>
    <div className="import-actions"><label className={`button button-dark ${busy || !sourceId ? "disabled" : ""}`}>Preview ZIP
      <input className="import-file" type="file" accept=".zip,application/zip" disabled={busy || !sourceId}
        onChange={(event) => { void prepare(event.target.files?.[0]); event.target.value = ""; }} /></label></div>
    {message && <p role="status" className="import-message">{message}</p>}
    {files.length > 0 && <div className="import-preview"><h3>Preview ({files.length})</h3>
      <p>Review the selected files. Possible credential values stay selected with a warning; private keys and known token patterns are blocked. This check can miss secrets. Missing files are kept. Confirm renames by selecting the saved file.</p>
      {skipped.length > 0 && <details><summary>Skipped files ({skipped.length})</summary><ul>{skipped.map((path, index) => <li key={index}><code>{path}</code></li>)}</ul></details>}
      {files.map((file) => {
        const row = rows.find((row) => row.file.path === file.path);
        return <article className="import-row" key={file.path}>
          <label className="file-choice"><input type="checkbox" checked={selected.has(file.path)} disabled={busy || !!file.blocked} onChange={() => toggle(file.path)} />
            {file.review ? "Include flagged file: " : "Include: "}{file.path}</label>
          <span>{row?.status ?? "Not selected"}{row?.previous?.path !== file.path && row?.previous ? ` · Rename ${row.previous.path}` : ""}</span>
          {(file.blocked || file.review) && <p role="note">{file.blocked ?? file.review}</p>}
          {row && (!row.previous || row.previous.path !== file.path) && <label>Saved file for {file.path}
            <select className="input" value={bindings[file.path] ?? ""} disabled={busy} onChange={(event) => bind(file.path, event.target.value)}>
              <option value="">New file</option>{state.map((saved) => <option value={saved.artifact_id} key={saved.artifact_id}
                disabled={rows.some((other) => other.file.path !== file.path && other.previous?.artifact_id === saved.artifact_id)}>Rename {saved.path ?? saved.artifact_id}</option>)}
            </select></label>}
          {row?.identityConflict && <p role="alert">This path belongs to another saved file. Select it or rename the incoming file.</p>}
          {row?.previous?.revision_id && <Link className="small" href={`/sources/revisions/${row.previous.revision_id}`} target="_blank">Current saved text</Link>}
          <details><summary>Review text for {file.path}</summary><pre>{file.body}</pre></details>
        </article>;
      })}
      <div className="import-actions"><button className="button button-dark" disabled={busy || !rows.length || rows.some((row) => row.identityConflict)} onClick={() => void accept()}>Accept selected files ({rows.length})</button>
        <button className="button button-light" disabled={busy} onClick={() => { setFiles([]); setSkipped([]); setMessage(""); }}>Cancel preview</button></div>
    </div>}
  </section>;
}
