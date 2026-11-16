import Link from "next/link";
import { requireAccount } from "@/lib/auth";
import { loadLibrarySources, loadLibraryArtifacts } from "@/lib/library-queries";

export default async function LibraryPage({ searchParams }: {
  searchParams: Promise<{ source?: string }>;
}) {
  const { supabase } = await requireAccount();
  const query = await searchParams;
  const sources = (await loadLibrarySources(supabase))
    .sort((a, b) => a.short_code.localeCompare(b.short_code, undefined, { numeric: true }));
  const source = query.source ? sources.find(row => row.short_code === query.source) : sources[0];
  const artifacts = source ? (await loadLibraryArtifacts(supabase, source.id))
    .sort((a, b) => a.short_code.localeCompare(b.short_code, undefined, { numeric: true })) : [];
  return <>
    <div className="page-heading"><h1>Library</h1><p>Your imported collections and their reading references.</p></div>
    <section className="panel library-source"><h2>Imported sources ({sources.length})</h2>
      {sources.length ? <ul>{sources.map(source => <li key={source.id}>
        <Link href={{ pathname: "/library", query: { source: source.short_code } }}>
          {source.short_code} · {source.name}</Link> · {source.kind.replaceAll("_", " ")}
      </li>)}</ul> : <p>No sources imported yet.</p>}
      <p><Link href="/notes">Import notes</Link> · <Link href="/repositories">Import a repository</Link></p>
      {query.source && !source && <p role="status">Source not found in your Library.</p>}
    </section>
    {source && <section className="panel library-source"><h2>{source.short_code} · {source.name} ({artifacts.length})</h2>
      <p>Read saved import text. Editable notes remain separate.</p>
      {artifacts.length ? <ul>{artifacts.map(item => <li key={item.id}>
        {item.current_revision_id ? <Link href={`/sources/revisions/${item.current_revision_id}`}>
          {source.short_code}/{item.short_code} · {item.path ?? item.external_id ?? "No saved path"}</Link>
          : <span>{source.short_code}/{item.short_code} · {item.path ?? item.external_id ?? "No saved path"} · No saved text</span>}
      </li>)}</ul> : <p>No saved items in this source.</p>}
    </section>}
  </>;
}
