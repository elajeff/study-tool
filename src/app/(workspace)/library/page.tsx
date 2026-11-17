import Link from "next/link";
import { requireAccount } from "@/lib/auth";
import { loadLibrarySources, loadLibraryArtifacts } from "@/lib/library-queries";
import { buildLibraryMaps } from "@/lib/library-map";
import { prepareProjectExport } from "@/app/library-actions";
import { loadConversationContexts } from "@/lib/conversation-queries";
import { loadLibraryDigests } from "@/lib/digest-queries";
import { currentLibraryDigests } from "@/lib/library-digest";

export default async function LibraryPage({ searchParams }: {
  searchParams: Promise<{ source?: string; map?: string }>;
}) {
  const { supabase } = await requireAccount();
  const query = await searchParams;
  const { data: snapshots, error: snapshotError } = await supabase.from("library_exports").select("id,created_at")
    .order("created_at", { ascending: false }).order("id").limit(20);
  if (snapshotError) throw new Error("Could not load saved Library snapshots.");
  const sources = (await loadLibrarySources(supabase))
    .sort((a, b) => a.short_code.localeCompare(b.short_code, undefined, { numeric: true }));
  const source = query.source ? sources.find(row => row.short_code === query.source) : sources[0];
  const artifacts = source ? await loadLibraryArtifacts(supabase, source.id) : [];
  const revisionIds = artifacts.flatMap(item => item.current_revision_id ? [item.current_revision_id] : []);
  const contexts = source && ["chatgpt", "claude"].includes(source.kind) ? await loadConversationContexts(supabase, revisionIds) : new Map();
  const digests = currentLibraryDigests(artifacts, contexts, await loadLibraryDigests(supabase, revisionIds));
  const summaries = new Map([...digests].map(([id, digest]) => [id, digest.summary]));
  const maps = source ? buildLibraryMaps(source, artifacts, summaries) : [];
  const map = query.map ? maps.find(row => row.id === query.map) : maps[0];
  return <>
    <div className="page-heading"><h1>Library</h1><p>Your imported collections and their reading references.</p></div>
    <section className="panel library-source"><h2>Imported sources ({sources.length})</h2>
      {sources.length ? <ul>{sources.map(source => <li key={source.id}>
        <Link href={{ pathname: "/library", query: { source: source.short_code } }}>
          {source.short_code} · {source.name}</Link> · {source.kind.replaceAll("_", " ")}
      </li>)}</ul> : <p>No sources imported yet.</p>}
      {!!sources.length && <form action={prepareProjectExport}>
        <fieldset><legend>Include in snapshot</legend>
          {sources.map(source => <label key={source.id} style={{ display: "block" }}>
            <input type="checkbox" name="source" value={source.id} defaultChecked /> {source.short_code} · {source.name}
          </label>)}
        </fieldset>
        <p><label><input type="checkbox" name="learning" value="include" /> Include learning history</label></p>
        <p>Adds saved course titles and reviewed assessment summaries from this account. Leave unchecked to export only the selected sources.</p>
        <p>Save a snapshot, then download its Study Library files for ChatGPT.</p>
        <p><button className="button button-dark">Save snapshot and open export</button></p>
      </form>}
      {query.source && !source && <p role="status">Source not found in your Library.</p>}
    </section>
    <section className="panel library-source"><h2>Saved snapshots</h2>
      <p>Open a snapshot to download its Study Library files. The 20 most recent snapshots are shown.</p>
      {snapshots.length ? <ul>{snapshots.map(snapshot => <li key={snapshot.id}>
        <Link href={`/library/exports/${snapshot.id}`}>Export snapshot · {new Date(snapshot.created_at).toLocaleString("en-GB", { timeZone: "UTC" })} UTC · {snapshot.id.slice(0, 9)}</Link>
      </li>)}</ul> : <p>No snapshots saved yet.</p>}
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
            : <span>{entry.id} · {entry.label}</span>}
          </li>;
        })}</ul>
        {!map.entries.length && <p>No saved items in this source.</p>}
        {map.next && <Link href={{ pathname: "/library", query: { source: source.short_code, map: map.next } }}>Next map page</Link>}
      </> : <p role="status">Map not found.</p>}
      {map?.id !== maps[0]?.id && <p><Link href={{ pathname: "/library", query: { source: source.short_code } }}>Source overview</Link></p>}
    </section>}
  </>;
}
