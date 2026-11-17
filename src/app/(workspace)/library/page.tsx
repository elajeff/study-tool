import Link from "next/link";
import { requireAccount } from "@/lib/auth";
import { loadLibrarySources, loadLibraryArtifacts } from "@/lib/library-queries";
import { buildLibraryMaps } from "@/lib/library-map";
import { prepareProjectExport } from "@/app/library-actions";

export default async function LibraryPage({ searchParams }: {
  searchParams: Promise<{ source?: string; map?: string }>;
}) {
  const { supabase } = await requireAccount();
  const query = await searchParams;
  const sources = (await loadLibrarySources(supabase))
    .sort((a, b) => a.short_code.localeCompare(b.short_code, undefined, { numeric: true }));
  const source = query.source ? sources.find(row => row.short_code === query.source) : sources[0];
  const artifacts = source ? await loadLibraryArtifacts(supabase, source.id) : [];
  const maps = source ? buildLibraryMaps(source, artifacts) : [];
  const map = query.map ? maps.find(row => row.id === query.map) : maps[0];
  return <>
    <div className="page-heading"><h1>Library</h1><p>Your imported collections and their reading references.</p></div>
    <section className="panel library-source"><h2>Imported sources ({sources.length})</h2>
      {sources.length ? <ul>{sources.map(source => <li key={source.id}>
        <Link href={{ pathname: "/library", query: { source: source.short_code } }}>
          {source.short_code} · {source.name}</Link> · {source.kind.replaceAll("_", " ")}
      </li>)}</ul> : <p>No sources imported yet.</p>}
      <p><Link href="/notes">Import notes</Link> · <Link href="/repositories">Import a repository</Link></p>
      {!!sources.length && <form action={prepareProjectExport}>
        <fieldset><legend>Include in snapshot</legend>
          {sources.map(source => <label key={source.id} style={{ display: "block" }}>
            <input type="checkbox" name="source" value={source.id} defaultChecked /> {source.short_code} · {source.name}
          </label>)}
        </fieldset>
        <p><button className="button button-light">Save Library snapshot</button></p>
      </form>}
      {query.source && !source && <p role="status">Source not found in your Library.</p>}
    </section>
    {source && <section className="panel library-source"><h2>{source.short_code} · {source.name} ({artifacts.length})</h2>
      <p>Read saved import text. Editable notes remain separate.</p>
      {map ? <>
        <h3>{map.id}</h3>
        <p className="muted small">{map.characters.toLocaleString()} characters · approximately {map.estimatedTokens.toLocaleString()} tokens (characters ÷ 4; estimate only)</p>
        <pre className="library-text">{map.text}</pre>
        <ul>{map.entries.map(entry => {
          const href = entry.artifact
            ? entry.artifact.current_revision_id && `/sources/revisions/${entry.artifact.current_revision_id}`
            : { pathname: "/library", query: { source: source.short_code, map: entry.id } };
          return <li key={entry.id}>{href ? <Link href={href}>{entry.id} · {entry.label}</Link>
            : <span>{entry.id} · {entry.label}</span>}</li>;
        })}</ul>
        {!map.entries.length && <p>No saved items in this source.</p>}
        {map.next && <Link href={{ pathname: "/library", query: { source: source.short_code, map: map.next } }}>Next map page</Link>}
      </> : <p role="status">Map not found.</p>}
      {map?.id !== maps[0]?.id && <p><Link href={{ pathname: "/library", query: { source: source.short_code } }}>Source overview</Link></p>}
    </section>}
  </>;
}
