import Link from "next/link";
import { FileText, ArrowUpRight } from "lucide-react";
import { requireAccount } from "@/lib/auth";
import { NotesImporter } from "@/components/NotesImporter";
import { createNote } from "@/app/actions";
import { loadNotes } from "@/lib/note-queries";
import type { Vault } from "@/lib/obsidian";

export default async function NotesPage({ searchParams }: { searchParams: Promise<{ search?: string }> }) {
  const { search = "" } = await searchParams;
  const { supabase } = await requireAccount();
  const [notes, { data: vaults, error }] = await Promise.all([
    loadNotes(supabase),
    supabase.from("sources").select("id,name,kind").in("kind", ["obsidian", "legacy_notes"]).order("created_at").order("id"),
  ]);
  if (error) throw new Error("Could not load vaults.");
  const filtered = notes.filter((note) => `${note.path} ${note.title}`.toLowerCase().includes(search.toLowerCase()));
  return <><div className="page-heading"><h1>Notes</h1><p><Link className="text-link" href="/curriculum">Browse note topics</Link> · For your ChatGPT learning roadmap, open <Link className="text-link" href="/courses">Courses</Link>.</p></div>
    <NotesImporter vaults={vaults as Vault[]} />
    <div className="notes-grid"><section className="panel"><div className="panel-head"><h2>Notes <span className="muted">({filtered.length})</span></h2></div>
      <form className="search-row" method="GET"><input name="search" className="input" placeholder="Filter by file name…" defaultValue={search} /><button className="button button-light" type="submit">Search</button></form>
      {filtered.length ? <div className="note-list">{filtered.map((note) => <Link className="note-row" key={note.id} href={`/notes/${note.id}`}><FileText size={19} /><span><strong>{note.title}</strong><small>{note.source_name} · {note.path}</small></span><ArrowUpRight size={17} /></Link>)}</div> : <div className="empty"><FileText size={26} /><h3>No notes found</h3><p>Import Markdown files, create a note, or check your search.</p></div>}
    </section>
      <section className="panel new-note"><h2>New note</h2><p className="muted">Links such as <code>[[Arrays]]</code> are recognized.</p><form action={createNote} className="stack"><label htmlFor="path">File path</label><input className="input" required id="path" name="path" placeholder="Concepts/Arrays.md" maxLength={240} /><label htmlFor="body">Content</label><textarea className="input" id="body" name="body" rows={8} placeholder="# Arrays\n\nNotes and examples." /><button className="button button-dark" type="submit">Create note</button></form></section></div>
  </>;
}
