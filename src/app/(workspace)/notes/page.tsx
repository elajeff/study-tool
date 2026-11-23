import Link from "next/link";
import { FileText, ArrowUpRight } from "lucide-react";
import { requireAccount } from "@/lib/auth";
import { NotesImporter } from "@/components/NotesImporter";
import { createNote } from "@/app/actions";
import { loadNoteList } from "@/lib/note-queries";
import type { Vault } from "@/lib/obsidian";

export default async function NotesPage({ searchParams }: { searchParams: Promise<{ search?: string; page?: string }> }) {
  const params = await searchParams;
  const search = typeof params.search === "string" ? params.search.trim().slice(0, 240) : "";
  const requestedPage = Number(params.page ?? 1);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 && requestedPage <= 10_000 ? requestedPage : 1;
  const { supabase } = await requireAccount();
  const [{ notes, hasNextPage }, { data: vaults, error }] = await Promise.all([
    loadNoteList(supabase, search, page),
    supabase.from("sources").select("id,name,kind").in("kind", ["obsidian", "legacy_notes"]).order("created_at").order("id"),
  ]);
  if (error) throw new Error("Could not load vaults.");
  const names = new Map(vaults.map(vault => [vault.id, vault.name]));
  return <><div className="page-heading"><h1>Notes</h1><p><Link className="text-link" href="/curriculum">Browse note topics</Link> · For your ChatGPT learning roadmap, open <Link className="text-link" href="/courses">Courses</Link>.</p></div>
    <NotesImporter vaults={vaults as Vault[]} />
    <div className="notes-grid"><section className="panel"><div className="panel-head"><h2>Notes</h2></div>
      <form className="search-row" method="GET"><input name="search" className="input" placeholder="Filter by file name…" defaultValue={search} maxLength={240} /><button className="button button-light" type="submit">Search</button></form>
      {notes.length ? <div className="note-list">{notes.map(note => (
        <Link className="note-row" key={note.id} href={`/notes/${note.id}`}>
          <FileText size={19} />
          <span><strong>{note.title}</strong><small>{names.get(note.source_id) ?? "Manual notes"} · {note.path}</small></span>
          <ArrowUpRight size={17} />
        </Link>
      ))}</div> : <div className="empty"><FileText size={26} /><h3>No notes found</h3><p>Import Markdown files, create a note, or check your search.</p></div>}
      {(page > 1 || hasNextPage) && <nav className="import-actions" aria-label="Note pages">
        {page > 1 && <Link href={{ pathname: "/notes", query: { search, page: page - 1 } }}>Previous page</Link>}
        {hasNextPage && <Link href={{ pathname: "/notes", query: { search, page: page + 1 } }}>Next page</Link>}
      </nav>}
    </section>
      <section className="panel new-note"><h2>New note</h2><p className="muted">Links such as <code>[[Arrays]]</code> are recognized.</p><form action={createNote} className="stack"><label htmlFor="path">File path</label><input className="input" required id="path" name="path" placeholder="Concepts/Arrays.md" maxLength={240} /><label htmlFor="body">Content</label><textarea className="input" id="body" name="body" rows={8} placeholder="# Arrays\n\nNotes and examples." /><button className="button button-dark" type="submit">Create note</button></form></section></div>
  </>;
}
