"use client";

import { useActionState } from "react";
import { removeNote } from "@/app/actions";

export function DeleteNoteForm({ id, updatedAt }: { id: string; updatedAt: string }) {
  const [error, action, pending] = useActionState(removeNote, null);
  return <form action={action} className="stack">
    <input type="hidden" name="id" value={id} />
    <input type="hidden" name="updated_at" value={updatedAt} />
    <label><input type="checkbox" name="confirm" required /> Confirm deletion</label>
    <button className="button button-danger" disabled={pending}>{pending ? "Deleting…" : "Delete note"}</button>
    {error && <p role="alert">{error}</p>}
  </form>;
}
