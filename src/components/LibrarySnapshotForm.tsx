"use client";
import { useActionState } from "react";
import { prepareProjectExport } from "@/app/library-actions";
import type { LibrarySource } from "@/lib/library-queries";

export function LibrarySnapshotForm({ sources }: { sources: LibrarySource[] }) {
  const [state, action, pending] = useActionState(prepareProjectExport, null);
  return <form action={action}>
    <fieldset disabled={pending}><legend>Include in snapshot</legend>
      {sources.map(source => <label key={source.id} style={{ display: "block" }}>
        <input type="checkbox" name="source" value={source.id} /> {source.short_code} · {source.name}
      </label>)}
      <p><label><input type="checkbox" name="learning" value="include" /> Include learning history</label></p>
    </fieldset>
    <p>Adds recent course titles from this account. Leave unchecked to export only the selected sources.</p>
    <p>Repositories with import history use the latest saved batch. Open a collection below to exclude individual items before saving.</p>
    {state?.error && <p role="alert">{state.error}</p>}
    {pending && <p role="status">Preparing and saving your selected sources. This may take a while for large collections.</p>}
    <p><button className="button button-dark" disabled={pending}>{pending ? "Saving snapshot…" : "Save snapshot and open export"}</button></p>
  </form>;
}
