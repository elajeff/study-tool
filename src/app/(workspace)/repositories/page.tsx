import Link from "next/link";
import { requireAccount } from "@/lib/auth";
import { loadRepositoryFiles } from "@/lib/source-queries";
import { RepositoryImporter } from "@/components/RepositoryImporter";

export default async function RepositoriesPage({ searchParams }: { searchParams: Promise<{ source?: string; search?: string }> }) {
  const { supabase } = await requireAccount();
  const { source, search = "" } = await searchParams;
  const { data: repositories, error } = await supabase.from("sources").select("id,name").eq("kind", "repository").order("created_at").order("id");
  if (error) throw new Error("Could not load repositories.");
  const selected = source ? repositories.find(repository => repository.id === source) : repositories[0];
  const files = selected ? await loadRepositoryFiles(supabase, selected.id) : [];
  const filtered = files.filter((file) => !search || file.path?.toLowerCase().includes(search.toLowerCase()));
  return <>
    <div className="page-heading"><h1>Repositories</h1><p>Saved source files. Importing or reading code does not count as demonstrated knowledge.</p></div>
    {source && !selected && <p role="status">This repository collection is unavailable. Choose a collection below.</p>}
    <RepositoryImporter key={selected?.id ?? "new"} repositories={repositories} sourceId={selected?.id ?? ""} />
    <section className="panel"><h2>{selected?.name ?? "Files"} ({filtered.length})</h2>
      <form className="search-row" method="GET"><input type="hidden" name="source" value={selected?.id ?? ""} />
        <input className="input" name="search" aria-label="Filter repository files" placeholder="Filter by file path…" defaultValue={search} /><button className="button button-light">Search</button></form>
      {filtered.length ? <div className="note-list repository-files">{filtered.sort((a, b) => (a.path ?? "").localeCompare(b.path ?? "")).map((file) => <div className="note-row" key={file.artifact_id}>
        {file.revision_id ? <Link href={`/sources/revisions/${file.revision_id}`}>{file.path ?? "Unnamed file"}</Link> : <span>{file.path ?? "Unnamed file"} · No saved text</span>}
      </div>)}</div> : <p className="muted small">No matching files. Select a repository or preview a ZIP.</p>}
    </section>
  </>;
}
