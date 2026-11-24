import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { NoteMarkdown } from "@/components/NoteMarkdown";
import { requireAccount } from "@/lib/auth";
import { loadNoteLinkTargets } from "@/lib/note-queries";
import { noteRelationships } from "@/lib/notes";
import { loadSourceAliases, loadSourceRevision } from "@/lib/source-queries";
import { DeleteNoteForm } from "@/components/DeleteNoteForm";
import { NoteEditor } from "@/components/NoteEditor";
import { NoteConnections } from "@/components/NoteConnections";

export default async function NotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await requireAccount();
  const { data: note, error } = await supabase.from("notes").select("id,path,title,body,updated_at,source_id,artifact:source_artifacts!note_artifact_fk(current_revision_id)").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (error) throw new Error("Could not load the note.");
  if (!note) notFound();
  const artifact = note.artifact as unknown as { current_revision_id: string | null } | null;
  const savedRevision = loadSourceRevision(supabase, artifact?.current_revision_id ?? null);
  const hasLinks = noteRelationships(note.body).length > 0;
  const [targets, aliases, original] = await Promise.all([
    hasLinks ? loadNoteLinkTargets(supabase, note.source_id) : [],
    hasLinks ? loadSourceAliases(supabase, note.source_id) : savedRevision.then(revision =>
      revision && noteRelationships(revision.content).length ? loadSourceAliases(supabase, note.source_id) : []),
    savedRevision,
  ]);
  return <><Link href="/notes" className="back-link"><ArrowLeft size={16} /> Back to notes</Link><div className="page-heading"><span className="eyebrow">{note.path}</span><h1>{note.title}</h1></div>
    <div className="notes-grid"><section className="panel"><h2>Edit Markdown</h2><NoteEditor key={note.id} id={note.id} body={note.body} updatedAt={note.updated_at} /><hr className="soft-divider" /><h3>Preview</h3><div className="markdown-preview"><NoteMarkdown body={note.body} /></div></section>
      <aside><NoteConnections body={note.body} notes={targets} aliases={aliases} original={original} /><section className="panel danger-panel"><h3>Delete note</h3><p className="muted small">Deletes the editable note. Source revisions are kept; your vault is unchanged.</p><DeleteNoteForm id={note.id} updatedAt={note.updated_at} /></section></aside>
    </div>
  </>;
}
