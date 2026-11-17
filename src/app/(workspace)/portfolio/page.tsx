import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAccount } from "@/lib/auth";
import { loadExportManifest } from "@/lib/export-queries";
import { repositoryDraftPrompt } from "@/lib/portfolio";
import { CourseLessonCard } from "@/components/CourseLessonCard";

export default async function PortfolioPage({ searchParams }: { searchParams: Promise<{ export?: string }> }) {
  const { supabase } = await requireAccount(), query = await searchParams;
  const { data: exports, error } = await supabase.from("library_exports").select("id").order("created_at", { ascending: false }).limit(50);
  if (error) throw new Error("Could not load saved Library snapshots.");
  const id = query.export ?? exports[0]?.id;
  const manifest = id ? await loadExportManifest(supabase, id) : null;
  if (query.export && !manifest) notFound();
  const repositories = manifest?.sources.filter(source => source.kind === "repository") ?? [];
  return <>
    <div className="page-heading"><h1>Portfolio</h1><p>Prepare a separate course draft for each repository in a saved Library snapshot.</p></div>
    <section className="panel"><form method="GET"><label htmlFor="portfolio-export">Saved Library snapshot</label>
      <select id="portfolio-export" name="export" className="input" defaultValue={id}>{exports.map(row => <option key={row.id} value={row.id}>{row.id}</option>)}</select>
      <p><button className="button button-light" disabled={!exports.length}>Open snapshot</button></p>
    </form><p><Link href="/library">Prepare a snapshot with the repositories you want</Link> · <Link href="/inbox">Import returned drafts</Link></p></section>
    {manifest && repositories.length ? <section className="panel"><h2>Repository drafts</h2>
      <p>Use each request in the ChatGPT Project containing this snapshot. Import its returned course through Inbox.</p>
      {repositories.map(source => <details key={source.id}><summary>{source.short_code} · {source.name}</summary>
        <CourseLessonCard text={repositoryDraftPrompt(manifest.export_id, source)} />
      </details>)}
    </section> : <p>Select a saved Library snapshot containing a repository.</p>}
  </>;
}
