"use client";
import { useActionState, useState } from "react";
import { importLibraryDigest } from "@/app/library-actions";

export function DigestImporter({ exportId }: { exportId: string }) {
  const [text, setText] = useState("");
  const [state, action, pending] = useActionState(importLibraryDigest, null);
  return <form action={action}>
    <input type="hidden" name="export_id" value={exportId} />
    <label htmlFor="digest-json">Study-digest JSON for this snapshot</label>
    <textarea id="digest-json" name="digest" className="input" rows={8} required maxLength={200000} value={text} onChange={event => setText(event.target.value)} />
    {state?.error && <p role="alert">{state.error}</p>}
    {state?.saved !== undefined && <p role="status">New summaries saved: {state.saved}. Identical summaries were kept.</p>}
    <p><button className="button button-light" disabled={pending}>{pending ? "Saving…" : "Validate and save summaries"}</button></p>
  </form>;
}
