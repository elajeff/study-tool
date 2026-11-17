"use client";
import { useState } from "react";
import type { GitHubPublicRepository } from "@/lib/github-import";

export function GitHubProfilePicker({ disabled, onSelect }: { disabled: boolean; onSelect: (repositories: GitHubPublicRepository[]) => void }) {
  const [url, setUrl] = useState("");
  const [repositories, setRepositories] = useState<GitHubPublicRepository[]>([]);
  const [selected, setSelected] = useState(new Set<string>());
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("");

  async function list(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setMessage(""); setRepositories([]); setSelected(new Set());
    try {
      const items: GitHubPublicRepository[] = [];
      let page: number | null = 1;
      while (page !== null) {
        const response = await fetch(`/api/repositories/github/profile?${new URLSearchParams({ url, page: String(page) })}`);
        if (!response.ok) throw new Error(await response.text());
        const result: { repositories: GitHubPublicRepository[]; nextPage: number | null } = await response.json();
        items.push(...result.repositories); page = result.nextPage;
      }
      setRepositories(items);
      if (!items.length) setMessage("This profile has no public repositories.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not list repositories."); }
    finally { setBusy(false); }
  }

  return <section className="profile-import"><h3>Import from a GitHub profile</h3>
    <p>List public repositories, then choose which to import. Each repository gets its own collection and file review. Private repositories require a ZIP.</p>
    <form onSubmit={list}><label htmlFor="github-profile">GitHub profile URL</label><div className="search-row">
      <input id="github-profile" className="input" type="url" required disabled={busy || disabled} value={url} placeholder="https://github.com/username"
        onChange={event => { setUrl(event.target.value); setRepositories([]); setSelected(new Set()); setMessage(""); }} />
      <button className="button button-light" disabled={busy || disabled}>{busy ? "Listing repositories…" : "List repositories"}</button>
    </div></form>
    {message && <p role="status">{message}</p>}
    {!!repositories.length && <>
      <div className="import-actions"><button className="button button-light" disabled={disabled} onClick={() => setSelected(new Set(repositories.map(item => item.url)))}>Select all</button>
        <button className="button button-light" disabled={disabled} onClick={() => setSelected(new Set())}>Clear selection</button></div>
      <div className="profile-repositories">{repositories.map(item => <article className="import-row" key={item.url}>
        <label className="file-choice"><input type="checkbox" checked={selected.has(item.url)} disabled={disabled} onChange={() => {
          const next = new Set(selected); if (next.has(item.url)) next.delete(item.url); else next.add(item.url); setSelected(next);
        }} />{item.name}{item.fork ? " · Fork" : ""}{item.archived ? " · Archived" : ""}</label>
        {item.description && <p className="muted small">{item.description}</p>}
      </article>)}</div>
      <button className="button button-dark" disabled={disabled || !selected.size} onClick={() => onSelect(repositories.filter(item => selected.has(item.url)))}>
        Review selected repositories ({selected.size})
      </button>
    </>}
  </section>;
}
