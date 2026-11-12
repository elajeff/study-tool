"use client";
import { useState } from "react";
import { updateNote } from "@/app/actions";

export function NoteEditor({ id, body, updatedAt }: { id: string; body: string; updatedAt: string }) {
  const [version, setVersion] = useState(updatedAt);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true); setMessage("");
    try {
      const result = await updateNote(form);
      if ("error" in result) setMessage(result.error);
      else { setVersion(result.updatedAt); setMessage("Saved."); }
    } catch {
      setMessage("Save could not be confirmed. Your text is kept here; copy it before reloading.");
    } finally { setBusy(false); }
  }
  return <form onSubmit={save} className="stack">
    <input type="hidden" name="id" value={id} /><input type="hidden" name="updated_at" value={version} />
    <textarea className="input code-editor" aria-label="Note content" name="body" rows={18} maxLength={500000} defaultValue={body} disabled={busy} />
    <button className="button button-dark" type="submit" disabled={busy}>{busy ? "Saving…" : "Save changes"}</button>
    {message && <p role="status">{message}</p>}
  </form>;
}
