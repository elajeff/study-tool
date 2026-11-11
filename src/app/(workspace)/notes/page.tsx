import Link from "next/link";
import { FileText, ArrowUpRight } from "lucide-react";
import { requireAccount } from "@/lib/auth";
import { NotesImporter } from "@/components/NotesImporter";
import { createNote } from "@/app/actions";
import type { Note } from "@/lib/notes";

export default async function NotesPage({ searchParams }: { searchParams: Promise<{ search?: string }> }) {
  const { search = "" } = await searchParams;
  const { supabase } = await requireAccount();
  const notes: Note[] = [];
  for (let offset = 0; offset < 3000; offset += 500) {
    const { data, error } = await supabase.from("notes")
      .select("id,path,title,body,updated_at").order("updated_at", { ascending: false }).range(offset, offset + 499);
    if (error) throw new Error("Could not load your notes.");
    notes.push(...(data ?? []) as Note[]);
    if (!data || data.length < 500) break;
  }
  const filtered = notes.filter((note) => `${note.path} ${note.title}`.toLowerCase().includes(search.toLowerCase()));
  return <><div className="page-heading"><span className="eyebrow">PERSONAL KNOWLEDGE</span><h1>Your notes, connected.</h1><p>Import Markdown from Obsidian, keep your own explanations, and take your notes with you.</p></div>
    <NotesImporter notes={notes} />
    <div className="notes-grid"><section className="panel"><div className="panel-head"><h2>Notes <span className="muted">({filtered.length})</span></h2></div>
      <form className="search-row" method="GET"><input name="search" className="input" placeholder="Filter by file name…" defaultValue={search} /><button className="button button-light" type="submit">Search</button></form>
      {filtered.length ? <div className="note-list">{filtered.map((note) => <Link className="note-row" key={note.id} href={`/notes/${note.id}`}><FileText size={19} /><span><strong>{note.title}</strong><small>{note.path}</small></span><ArrowUpRight size={17} /></Link>)}</div> : <div className="empty"><FileText size={26} /><h3>No notes here yet</h3><p>Import your Markdown files or create your first note.</p></div>}
    </section>
      <section className="panel new-note"><h2>New note</h2><p className="muted">Use a simple Markdown file. Links like <code>[[Arrays]]</code> are recognized.</p><form action={createNote} className="stack"><label htmlFor="path">File path</label><input className="input" required id="path" name="path" placeholder="Concepts/Arrays.md" maxLength={240} /><label htmlFor="body">Content</label><textarea className="input" id="body" name="body" rows={8} placeholder="# Arrays\n\nWhat I learned…" /><button className="button button-dark" type="submit">Create note</button></form></section></div>
  </>;
}
