import Link from "next/link";
import { requireAccount } from "@/lib/auth";
import { loadLibrarySources } from "@/lib/library-queries";

export default async function LibraryPage() {
  const { supabase } = await requireAccount();
  const sources = (await loadLibrarySources(supabase))
    .sort((a, b) => a.short_code.localeCompare(b.short_code, undefined, { numeric: true }));
  return <>
    <div className="page-heading"><h1>Library</h1><p>Your imported collections and their reading references.</p></div>
    <section className="panel"><h2>Imported sources ({sources.length})</h2>
      {sources.length ? <ul>{sources.map(source => <li key={source.id}>
        <strong>{source.short_code} · {source.name}</strong> · {source.kind.replaceAll("_", " ")}
      </li>)}</ul> : <p>No sources imported yet.</p>}
      <p><Link href="/notes">Import notes</Link> · <Link href="/repositories">Import a repository</Link></p>
    </section>
  </>;
}
