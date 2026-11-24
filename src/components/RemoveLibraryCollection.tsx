"use client";
import { useActionState } from "react";
import { removeLibraryCollection } from "@/app/library-actions";

export function RemoveLibraryCollection({ sourceId, exportIds, courseIds }: { sourceId: string; exportIds: string[]; courseIds: string[] }) {
  const [error, action, pending] = useActionState(removeLibraryCollection, "");
  return <form className="stack" action={action}>
    <input type="hidden" name="source_id" value={sourceId} />
    {exportIds.map(id => <input type="hidden" name="export_id" value={id} key={id} />)}
    {courseIds.map(id => <input type="hidden" name="course_id" value={id} key={id} />)}
    <label><input type="checkbox" name="confirm" value="yes" required /> Permanently remove the collection and everything listed above</label>
    <button className="button button-danger" disabled={pending}>{pending ? "Removing…" : "Remove collection"}</button>
    {error && <p role="alert">{error}</p>}
  </form>;
}
