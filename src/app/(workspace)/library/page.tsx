import Link from "next/link";
import { requireAccount } from "@/lib/auth";
import { loadLibrarySources, loadLibraryArtifacts, loadLatestRepositoryItems } from "@/lib/library-queries";
import { setLibraryItemExclusion } from "@/app/library-actions";
import { buildLibraryMaps } from "@/lib/library-map";
import { LibrarySnapshotForm } from "@/components/LibrarySnapshotForm";
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
  const latest = source?.kind === "repository" ? await loadLatestRepositoryItems(supabase, source.id) : null;
  const revisionIds = artifacts.flatMap(item => item.current_revision_id ? [item.current_revision_id] : []);
  const contexts = source && ["chatgpt", "claude"].includes(source.kind) ? await loadConversationContexts(supabase, revisionIds) : new Map();
  const digests = currentLibraryDigests(artifacts, contexts, await loadLibraryDigests(supabase, revisionIds));
  const summaries = new Map([...digests].map(([id, digest]) => [id, digest.summary]));
  const maps = source ? buildLibraryMaps(source, artifacts, summaries) : [];
  const map = query.map ? maps.find(row => row.id === query.map) : maps[0];
  return <>
    <div className="page-heading"><h1>Library</h1><p>Your imported collections and their reading references.</p></div>
    <section className="panel library-source" id="library-snapshot"><h2>Imported sources ({sources.length})</h2>
      {sources.length ? <ul>{sources.map(source => <li key={source.id}>
        <Link href={{ pathname: "/library", query: { source: source.short_code } }}>
          {source.short_code} · {source.name}</Link> · {source.kind.replaceAll("_", " ")}
      </li>)}</ul> : <p>No sources imported yet.</p>}
      {!!sources.length && <LibrarySnapshotForm sources={sources} />}
      {query.source && !source && <p role="status">Source not found in your Library.</p>}
    </section>
    <section className="panel library-source" id="library-downloads"><h2>Download your Study Library</h2>
      <p>Download a saved snapshot, then upload its files to your ChatGPT Project. The 20 most recent snapshots are shown.</p>
      {snapshots.length ? <div className="saved-exports">{snapshots.map(snapshot => <article className="saved-export" key={snapshot.id}>
        <p>Saved {new Date(snapshot.created_at).toLocaleString("en-GB", { timeZone: "UTC" })} UTC · {snapshot.id.slice(0, 9)}</p>
        <Link className="button button-light" href={`/library/exports/${snapshot.id}`}>Review and download</Link>
      </article>)}</div> : <p>No snapshots saved yet.</p>}
    </section>
    {source && <section className="panel library-source"><h2>{source.short_code} · {source.name} ({artifacts.length})</h2>
      <p>Read saved import text. Editable notes remain separate.</p>
      <Link className="back-link" href={`/library/collections/${source.id}/remove`}>Remove collection</Link>
      {map ? <>
        <h3>{map.id}</h3>
        <ul>{map.entries.map(entry => {
          const href = entry.artifact
            ? entry.artifact.current_revision_id && `/sources/revisions/${entry.artifact.current_revision_id}`
            : { pathname: "/library", query: { source: source.short_code, map: entry.id } };
          const item = entry.artifact;
          return <li key={entry.id}>{href ? <Link href={href}>{entry.id} · {entry.label}</Link>
            : <span>{entry.id} · {entry.label}</span>}
            {item && (latest && !latest.has(item.id) ? <p className="muted small">Older import · excluded from new snapshots</p>
              : <form action={setLibraryItemExclusion}>
                <input type="hidden" name="item" value={item.id} />
                <input type="hidden" name="exclude" value={item.exclude_from_library ? "no" : "yes"} />
                <button className="button button-light" aria-label={`${item.exclude_from_library ? "Include" : "Exclude"} ${entry.id} in new snapshots`}>
                  {item.exclude_from_library ? "Include in new snapshots" : "Exclude from new snapshots"}
                </button>
              </form>)}
          </li>;
        })}</ul>
        {!map.entries.length && <p>No saved items in this source.</p>}
        {map.next && <Link href={{ pathname: "/library", query: { source: source.short_code, map: map.next } }}>Next map page</Link>}
      </> : <p role="status">Map not found.</p>}
      {map?.id !== maps[0]?.id && <p><Link href={{ pathname: "/library", query: { source: source.short_code } }}>Source overview</Link></p>}
    </section>}
  </>;
}
