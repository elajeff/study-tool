"use client";

import { useState } from "react";
import { parseConversationExport, type ChatProvider } from "@/lib/conversation-import";
import { inspectImportText } from "@/lib/import-privacy";

export function ConversationPreview() {
  const [provider, setProvider] = useState<ChatProvider>("chatgpt");
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ReturnType<typeof parseConversationExport> | null>(null);
  const [selected, setSelected] = useState(0);
  const [page, setPage] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function preview() {
    if (!file) return;
    setBusy(true); setError(""); setResult(null); setSelected(0); setPage(0);
    try {
      if (file.size > 100 * 1024 * 1024) throw new Error("Select an export smaller than 100 MiB.");
      setResult(parseConversationExport(await file.text(), provider));
    } catch (error) {
      setError(error instanceof SyntaxError ? "This file is not valid JSON."
        : error instanceof Error ? error.message : "Could not read the file.");
    } finally { setBusy(false); }
  }

  const conversation = result?.conversations[selected];
  const slice = conversation?.pages[page];
  const credentialWarning = conversation ? inspectImportText(conversation.text).review : null;
  return <>
    <section className="panel"><h2>Preview an export</h2>
      <p>Export text is processed in this browser. This preview does not save conversations or send their text to an AI service.</p>
      <p>Recognizable access tokens and private keys are removed from preview text. Other possible credentials are kept with warnings. Personal information and unrecognized secrets may remain. Keep the original export separately.</p>
      <label htmlFor="chat-provider">Export format</label>
      <select id="chat-provider" className="input" value={provider} disabled={busy} onChange={event => {
        setProvider(event.target.value as ChatProvider); setResult(null); setError("");
      }}><option value="chatgpt">ChatGPT</option><option value="claude">Claude</option></select>
      <label htmlFor="chat-file">Conversations JSON</label>
      <input id="chat-file" type="file" accept=".json,application/json" disabled={busy} onChange={event => {
        setFile(event.target.files?.[0] ?? null); setResult(null); setError("");
      }} />
      <p><button className="button button-dark" disabled={busy || !file} onClick={() => void preview()}>
        {busy ? "Reading export…" : "Preview conversations"}</button></p>
      {error && <p role="alert">{error}</p>}
    </section>
    {result && <section className="panel"><h2>Preview results</h2>
      <p>Conversations: {result.conversations.length} · Empty: {result.empty} · Identical duplicates: {result.duplicates} · Rejected: {result.rejected.length}.</p>
      <p>Possible credential values removed: {result.conversations.reduce((total, item) => total + item.redactions, 0)}. Hidden reasoning, tools and unselected branches are excluded. Visible code and mathematics are not shortened; credential redactions still apply.</p>
      {!!result.rejected.length && <details><summary>Rejected records</summary><ul>{result.rejected.map(item =>
        <li key={item.index}>Record {item.index + 1}: {item.reason}</li>)}</ul></details>}
      {!!result.conversations.length && <><label htmlFor="chat-conversation">Conversation</label>
        <select id="chat-conversation" className="input" value={selected} onChange={event => { setSelected(Number(event.target.value)); setPage(0); }}>
          {result.conversations.map((item, index) => <option key={item.id} value={index}>{item.title}</option>)}
        </select></>}
      {conversation && slice && <>
        {credentialWarning && <p role="note">{credentialWarning}</p>}
        <p>Visible messages: {conversation.messages.length} · Page {page + 1} / {conversation.pages.length}. Large turns remain intact.</p>
        <details><summary>Excluded content counts</summary><pre>{JSON.stringify(conversation.excluded, null, 2)}</pre></details>
        <pre className="library-text">{conversation.text.slice(slice.start, slice.end)}</pre>
        <button className="button button-light" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous page</button>{" "}
        <button className="button button-light" disabled={page + 1 === conversation.pages.length} onClick={() => setPage(page + 1)}>Next page</button>
      </>}
    </section>}
  </>;
}
