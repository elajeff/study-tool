"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { readImportFiles, type ImportFile } from "@/lib/import-files";
import { inspectRepositoryText, repositoryArchiveRoot, previewRepository, shouldImportRepositoryFile, type RepositoryFile } from "@/lib/repository-import";
import { loadRepositoryFiles } from "@/lib/source-queries";
import type { RepositoryOrigin } from "@/lib/repository-origin";
import type { GitHubPublicRepository } from "@/lib/github-import";
import { GitHubProfilePicker } from "@/components/GitHubProfilePicker";

type Repository = { id: string; name: string };
type ReviewedFile = ImportFile & ReturnType<typeof inspectRepositoryText>;

async function downloadGitHub(url: string, ref = "") {
  const form = new FormData(); form.set("url", url); form.set("ref", ref);
  const response = await fetch("/api/repositories/github", { method: "POST", body: form });
  if (!response.ok) throw new Error(await response.text());
  const savedUrl = response.headers.get("X-Repository-URL"), commit = response.headers.get("X-Repository-Commit");
  if (!savedUrl || !commit) throw new Error("Download has no repository identity.");
  return { file: new File([await response.blob()], "github.zip", { type: "application/zip" }), snapshot: { url: savedUrl, commit } };
}

export function RepositoryImporter({ repositories, sourceId }: { repositories: Repository[]; sourceId: string }) {
  const router = useRouter();
  const [url, setUrl] = useState(""), [ref, setRef] = useState("");
  const [githubSnapshot, setGitHubSnapshot] = useState<{ url: string; commit: string } | null>(null);
  const [name, setName] = useState("");
  const [files, setFiles] = useState<ReviewedFile[]>([]);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [selected, setSelected] = useState(new Set<string>());
  const [state, setState] = useState<RepositoryFile[]>([]);
  const [bindings, setBindings] = useState<Record<string, string>>({});
  const [renamePath, setRenamePath] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [queue, setQueue] = useState<GitHubPublicRepository[]>([]), [batchSize, setBatchSize] = useState(0);
  const [destinationId, setDestinationId] = useState(sourceId);
  const rows = previewRepository(files.filter((file) => selected.has(file.path)), state, bindings);
  const rowsByPath = new Map(rows.map(row => [row.file.path, row]));
  const assigned = new Set(rows.map(row => row.previous?.artifact_id));

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

  async function prepare(file: File | undefined, snapshot?: { url: string; commit: string }, targetSourceId = sourceId) {
    if (!file) return;
    setBusy(true); setMessage(`Reading ${file.name}…`); setFiles([]); setSkipped([]); setGitHubSnapshot(null);
    try {
      if (!file.name.toLowerCase().endsWith(".zip")) throw new Error("Select a ZIP archive.");
      const parsed = await readImportFiles([file], shouldImportRepositoryFile, snapshot ? repositoryArchiveRoot : undefined);
      setMessage("Comparing files with the saved repository…");
      const current = targetSourceId ? await loadRepositoryFiles(createClient(), targetSourceId) : [];
      const reviewed = parsed.files.map((file) => ({ ...file, ...inspectRepositoryText(file.body) }));
      setState(current); setBindings({}); setRenamePath(""); setFiles(reviewed); setSkipped(parsed.skipped);
      setDestinationId(targetSourceId);
      setGitHubSnapshot(snapshot ?? null);
      setSelected(new Set(reviewed.filter((file) => !file.blocked).map((file) => file.path)));
      setMessage(`${reviewed.length} files ready for review. Nothing has been saved yet.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not preview the archive."); }
    finally { setBusy(false); }
  }

  async function prepareGitHub(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setMessage(""); setFiles([]); setSkipped([]); setGitHubSnapshot(null);
    try {
      const download = await downloadGitHub(url, ref);
      await prepare(download.file, download.snapshot);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not preview the repository."); }
    finally { setBusy(false); }
  }

  async function prepareNext(repository: GitHubPublicRepository) {
    setBusy(true); setMessage(""); setFiles([]); setSkipped([]); setGitHubSnapshot(null); setDestinationId("");
    try {
      const download = await downloadGitHub(repository.url);
      const { data, error } = await createClient().from("source_imports").select("source_id")
        .ilike("repository_origin->>url", repository.url.replaceAll("_", "\\_")).order("accepted_at", { ascending: false }).limit(1).maybeSingle();
      if (error) throw new Error("Could not check previous imports of this repository.");
      await prepare(download.file, download.snapshot, data?.source_id ?? "");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not preview the repository."); }
    finally { setBusy(false); }
  }

  async function advanceQueue() {
    const remaining = queue.slice(1); setQueue(remaining);
    if (remaining.length) await prepareNext(remaining[0]);
    else { setFiles([]); setSkipped([]); setGitHubSnapshot(null); setMessage("Repository queue finished. Saved repositories are in your Library."); router.refresh(); }
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
      const origin: RepositoryOrigin = { format: "study-repository/1", kind: githubSnapshot ? "github" : "archive", url: githubSnapshot?.url ?? null, commit: githubSnapshot?.commit ?? null,
        excluded: [...skipped, ...files.filter(file => !selected.has(file.path)).map(file => file.path)] };
      const client = createClient(); let targetSourceId = destinationId;
      if (!targetSourceId && queue.length) {
        const { data: { user } } = await client.auth.getUser();
        if (!user) throw new Error("Sign in again.");
        const { data, error } = await client.from("sources").insert({ user_id: user.id, kind: "repository", name: queue[0].name }).select("id").single();
        if (error) throw new Error("Could not create the repository collection.");
        targetSourceId = data.id; setDestinationId(targetSourceId);
      }
      const { error } = await client.rpc("accept_repository_import", { p_source_id: targetSourceId, p_entries: entries, p_origin: origin });
      if (error) throw new Error(error.message);
      if (queue.length) await advanceQueue();
      else { setFiles([]); setSkipped([]); setGitHubSnapshot(null); setMessage("Import accepted."); router.refresh(); }
    } catch (error) { setMessage(error instanceof Error ? error.message : "Import could not be confirmed. Select the ZIP again before retrying."); }
    finally { setBusy(false); }
  }

  return <section className="panel vault-import"><h2>Import repository</h2>
    {!queue.length && !files.length && <GitHubProfilePicker disabled={busy} onSelect={items => {
      setQueue(items); setBatchSize(items.length); void prepareNext(items[0]);
    }} />}
    {!!queue.length && <div className="repository-queue"><h3>Repository {batchSize - queue.length + 1} of {batchSize}: {queue[0].name}</h3>
      <p>Review and save to continue to the next repository. Previous GitHub imports use their existing collection. New collections are named after the repository.</p>
      <div className="import-actions">{!files.length && !busy && <button className="button button-light" onClick={() => void prepareNext(queue[0])}>Retry download</button>}
        <button className="button button-light" disabled={busy} onClick={() => void advanceQueue()}>Skip repository</button>
        <button className="button button-light" disabled={busy} onClick={() => { setQueue([]); setFiles([]); setSkipped([]); setGitHubSnapshot(null); setMessage("Import stopped. Previously saved repositories are kept."); router.refresh(); }}>Stop import</button></div>
    </div>}
    <div hidden={!!queue.length}>
    <h3>Import one repository</h3>
    <p>Reuse the same repository when reimporting. ZIP paths are kept as stored, including enclosing folders. Files are never executed.</p>
    <div className="vault-controls"><div><label htmlFor="repository-source">Repository</label>
      <select id="repository-source" className="input" value={sourceId} disabled={busy} onChange={(event) => {
        setBusy(true); setFiles([]); setSkipped([]); router.push(`/repositories?source=${event.target.value}`);
      }}>
        {!sourceId && <option value="" disabled>{repositories.length ? "Choose a repository" : "Create a repository first"}</option>}
        {repositories.map((repository) => <option key={repository.id} value={repository.id}>{repository.name}{repositories.some((other) => other.id !== repository.id && other.name === repository.name) ? ` (${repository.id})` : ""}</option>)}
      </select></div>
      <form onSubmit={createRepository}><label htmlFor="repository-name">New repository name</label><div className="search-row">
        <input id="repository-name" className="input" value={name} onChange={(event) => setName(event.target.value)} required maxLength={160} disabled={busy} />
        <button className="button button-light" disabled={busy}>Create repository</button>
      </div></form></div>
    <form onSubmit={prepareGitHub} className="stack repository-github-form">
      <label htmlFor="github-url">Public GitHub repository URL</label>
      <input id="github-url" className="input" type="url" value={url} onChange={event => setUrl(event.target.value)} required disabled={busy || !sourceId} placeholder="https://github.com/owner/repository" />
      <label htmlFor="github-ref">Branch, tag or commit</label>
      <input id="github-ref" className="input" value={ref} onChange={event => setRef(event.target.value)} maxLength={200} disabled={busy || !sourceId} placeholder="Default branch" />
      <button className="button button-light" disabled={busy || !sourceId}>Preview GitHub repository</button>
    </form>
    <div className="import-actions"><label className={`button button-dark ${busy || !sourceId ? "disabled" : ""}`}>Preview ZIP
      <input className="import-file" type="file" accept=".zip,application/zip" disabled={busy || !sourceId}
        onChange={(event) => { void prepare(event.target.files?.[0]); event.target.value = ""; }} /></label></div>
    </div>
    {githubSnapshot && <p>Downloaded {githubSnapshot.url} at commit {githubSnapshot.commit}. Paths use the repository root. Existing ZIP imports may include an outer folder; compare paths before saving.</p>}
    {busy && !!queue.length && <p role="status">Working on {queue[0].name}…</p>}
    {message && <p role="status" className="import-message">{message}</p>}
    {files.length > 0 && <div className="import-preview"><h3>Preview ({files.length})</h3>
      <p>Review the selected files. Possible credential values stay selected with a warning; private keys and known token patterns are blocked. This check can miss secrets. Missing files are kept. Confirm renames by selecting the saved file.</p>
      {skipped.length > 0 && <details><summary>Skipped files ({skipped.length})</summary><ul>{skipped.map((path, index) => <li key={index}><code>{path}</code></li>)}</ul></details>}
      {files.map((file) => {
        const row = rowsByPath.get(file.path);
        return <article className="import-row" key={file.path}>
          <label className="file-choice"><input type="checkbox" checked={selected.has(file.path)} disabled={busy || !!file.blocked} onChange={() => toggle(file.path)} />
            {file.review ? "Include flagged file: " : "Include: "}{file.path}</label>
          <span>{row?.status ?? "Not selected"}{row?.previous?.path !== file.path && row?.previous ? ` · Rename ${row.previous.path}` : ""}</span>
          {(file.blocked || file.review) && <p role="note">{file.blocked ?? file.review}</p>}
          {row && (!row.previous || row.previous.path !== file.path) && state.length > 0 && <>
            <button type="button" className="text-link" disabled={busy} aria-expanded={renamePath === file.path}
              onClick={() => setRenamePath(renamePath === file.path ? "" : file.path)}>Match a renamed file</button>
            {renamePath === file.path && <label>Saved file for {file.path}
              <select className="input" value={bindings[file.path] ?? ""} disabled={busy} onChange={event => bind(file.path, event.target.value)}>
                <option value="">New file</option>
                {state.map(saved => <option value={saved.artifact_id} key={saved.artifact_id}
                  disabled={assigned.has(saved.artifact_id) && row.previous?.artifact_id !== saved.artifact_id}>
                  {saved.path ?? saved.artifact_id}
                </option>)}
              </select>
            </label>}
          </>}
          {row?.identityConflict && <p role="alert">This path belongs to another saved file. Select it or rename the incoming file.</p>}
          {row?.previous?.revision_id && <Link className="small" href={`/sources/revisions/${row.previous.revision_id}`} target="_blank">Current saved text</Link>}
          <details><summary>Review text for {file.path}</summary><pre>{file.body}</pre></details>
        </article>;
      })}
      <div className="import-actions"><button className="button button-dark" disabled={busy || !rows.length || rows.some((row) => row.identityConflict)} onClick={() => void accept()}>
        {queue.length > 1 ? "Save repository and continue" : "Save selected files"} ({rows.length})
      </button>
        {!queue.length && <button className="button button-light" disabled={busy} onClick={() => { setFiles([]); setSkipped([]); setGitHubSnapshot(null); setMessage(""); }}>Cancel preview</button>}</div>
    </div>}
  </section>;
}
