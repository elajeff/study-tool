"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { parseConversationExport, type ChatProvider } from "@/lib/conversation-import";
import { prepareConversationEntries, loadConversationState } from "@/lib/conversation-storage";
import { createClient } from "@/lib/supabase/client";
import type { LibrarySource } from "@/lib/library-queries";
import { inspectImportText } from "@/lib/import-privacy";
import { sourceTimeText } from "@/lib/conversation-context";

export function ConversationPreview({ sources, sourceId }: { sources: LibrarySource[]; sourceId: string }) {
  const router = useRouter(), source = sources.find(item => item.id === sourceId);
  const [files, setFiles] = useState<File[]>([]), [provider, setProvider] = useState<ChatProvider>(source?.kind === "claude" ? "claude" : "chatgpt");
  const [name, setName] = useState(""), [saved, setSaved] = useState(false);
  const [entries, setEntries] = useState<Awaited<ReturnType<typeof prepareConversationEntries>>>([]);
  const [result, setResult] = useState<ReturnType<typeof parseConversationExport> | null>(null);
  const [selected, setSelected] = useState(0), [page, setPage] = useState(0), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  async function preview() {
    if (!files.length) return;
    setBusy(true); setError(""); setSaved(false); setEntries([]); setResult(null); setSelected(0); setPage(0);
    try {
      if (files.reduce((size, file) => size + file.size, 0) > 100 * 1024 * 1024) throw new Error("Select JSON shards smaller than 100 MiB combined.");
      const texts = []; for (const file of files) texts.push(await file.text());
      const parsed = parseConversationExport(texts, provider); setResult(parsed);
      if (source?.kind === provider && parsed.conversations.length)
        setEntries(await prepareConversationEntries(parsed.conversations, await loadConversationState(createClient(), sourceId)));
    } catch (error) { setError(error instanceof SyntaxError ? "This file is not valid JSON." : error instanceof Error ? error.message : "Could not read the file."); }
    finally { setBusy(false); }
  }
  async function createSource(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setSaved(false);
    try {
      const client = createClient(), { data: { user } } = await client.auth.getUser();
      if (!user) throw new Error("Sign in again.");
      const { data, error } = await client.from("sources").insert({ user_id: user.id, kind: provider, name: name.trim() }).select("id").single();
      if (error) throw new Error("Could not create a conversation source. Check the name and migration 008.");
      router.push(`/conversations?source=${data.id}`);
    } catch (error) { setError(error instanceof Error ? error.message : "Could not create source."); }
    finally { setBusy(false); }
  }
  async function accept() {
    setBusy(true); setError("");
    try {
      if (!entries.length || source?.kind !== provider) throw new Error("Select a matching source and preview the files again.");
      const { error } = await createClient().rpc("accept_conversation_import", { p_source_id: sourceId,
        p_entries: entries });
      if (error) throw new Error(error.message);
      setResult(null); setEntries([]); setSaved(true); router.refresh();
    } catch (error) { setError(error instanceof Error ? error.message : "Could not confirm import. Preview again before retrying."); }
    finally { setBusy(false); }
  }
  const conversation = result?.conversations[selected], slice = conversation?.pages[page];
  const credentialWarning = conversation ? inspectImportText(conversation.text).review : null;
  return <>
    <section className="panel"><h2>Preview an export</h2>
      <p>Raw exports are processed in this browser. Saving sends the prepared conversations to your Study Tool account. Keep the original exports separately.</p>
      <p>Recognizable access tokens and private keys are removed from preview text. Other possible credentials are kept with warnings. Personal information and unrecognized secrets may remain.</p>
      <label htmlFor="chat-provider">Export format</label>
      <select id="chat-provider" className="input" value={provider} disabled={busy} onChange={event => { setProvider(event.target.value as ChatProvider); setResult(null); setEntries([]); setError(""); setSaved(false); }}>
        <option value="chatgpt">ChatGPT</option><option value="claude">Claude</option>
      </select>
      <label htmlFor="chat-source">Saved conversation source</label>
      <select id="chat-source" className="input" value={sourceId} disabled={busy} onChange={event => router.push(`/conversations?source=${event.target.value}`)}>
        {!sources.length && <option value="">Create a source to save conversations</option>}
        {sources.map(item => <option key={item.id} value={item.id}>{item.short_code} · {item.name} ({item.kind})</option>)}
      </select>
      <form onSubmit={createSource}><label htmlFor="chat-source-name">New source name</label>
        <input id="chat-source-name" className="input" required maxLength={160} value={name} disabled={busy} onChange={event => setName(event.target.value)} />
        <button className="button button-light" disabled={busy}>Create conversation source</button>
      </form>
      <p>Reuse the same source for reimports. Missing conversations are retained.</p>
      <label htmlFor="chat-file">Conversations JSON</label><input id="chat-file" className="input" type="file" multiple accept=".json,application/json" disabled={busy}
        onChange={event => { setFiles(Array.from(event.target.files ?? [])); setResult(null); setEntries([]); setError(""); setSaved(false); }} />
      <p><button className="button button-dark" disabled={!files.length || busy} onClick={() => void preview()}>{busy ? "Working…" : "Preview conversations"}</button></p>
      {error && <p role="alert">{error}</p>}
      {saved && <p role="status">Conversations saved. <Link href="/library">Open Library</Link></p>}
    </section>
    {result && <section className="panel"><h2>Preview results</h2>
      <p>Conversations: {result.conversations.length} · Empty: {result.empty} · Identical duplicates: {result.duplicates} · Rejected: {result.rejected.length}.</p>
      <p>Possible credential values removed: {result.conversations.reduce((total, item) => total + item.redactions, 0)}. Hidden reasoning, tools and unselected branches are excluded. Visible code and mathematics are not shortened; credential redactions still apply.</p>
      {entries.length ? <><p>New: {entries.filter(item => item.status === "New").length} · Updated: {entries.filter(item => item.status === "Updated").length} · Unchanged: {entries.filter(item => item.status === "Unchanged").length}.</p>
        <button className="button button-dark" disabled={busy} onClick={() => void accept()}>Save conversations ({entries.length})</button></>
        : <p>{result.conversations.length ? "Select or create a source matching this export format before saving." : "No conversations available to save."}</p>}
      {!!result.rejected.length && <details><summary>Rejected records</summary><ul>{result.rejected.map(item => <li key={item.index}>Record {item.index + 1}: {item.reason}</li>)}</ul></details>}
      {!!result.conversations.length && <><label htmlFor="chat-conversation">Conversation</label>
        <select id="chat-conversation" className="input" value={selected} onChange={event => { setSelected(Number(event.target.value)); setPage(0); }}>
          {result.conversations.map((item, index) => <option key={item.id} value={index}>{item.title}</option>)}
        </select></>}
      {conversation && slice && <>
        {credentialWarning && <p role="note">{credentialWarning}</p>}
        <p>Visible messages: {conversation.messages.length} · Page {page + 1} / {conversation.pages.length}. Large turns remain intact.</p>
        <p>Source-reported dates · Created: {sourceTimeText(conversation.created_at)} · Updated: {sourceTimeText(conversation.updated_at)}.</p>
        <details><summary>Excluded content counts</summary><pre>{JSON.stringify(conversation.excluded, null, 2)}</pre></details>
        <pre className="library-text">{conversation.text.slice(slice.start, slice.end)}</pre>
        <button className="button button-light" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous page</button>{" "}
        <button className="button button-light" disabled={page + 1 === conversation.pages.length} onClick={() => setPage(page + 1)}>Next page</button>
      </>}
    </section>}
  </>;
}
