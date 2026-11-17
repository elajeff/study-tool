import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAccount } from "@/lib/auth";
import { loadCourse } from "@/lib/course-queries";
import { CourseImporter } from "@/components/CourseImporter";

export default async function CoursesPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { supabase } = await requireAccount();
  const query = await searchParams;
  const { data: recent, error } = await supabase.from("courses").select("id,title:raw_block->>title")
    .order("created_at", { ascending: false }).limit(20);
  if (error) throw new Error("Could not load courses. Check migration 011.");
  const result = query.id ? await loadCourse(supabase, query.id) : null;
  if (query.id && !result) notFound();
  return <>
    <div className="page-heading"><h1>Courses</h1><p>Saved outlines reference the exported source versions. Importing an outline does not demonstrate mastery.</p></div>
    <section className="panel"><details open={!query.id}><summary>Import from ChatGPT</summary>
      <p>Paste one complete course JSON object or study-course code block. The Library version is detected automatically.</p><CourseImporter />
      <p><Link href="/library">Prepare a Library snapshot</Link></p>
    </details></section>
    <section className="panel"><h2>Recent courses</h2>
      {recent.length ? <ul>{recent.map(row => <li key={row.id}><Link href={`/courses?id=${row.id}`}>{row.title}</Link></li>)}</ul> : <p>No courses saved yet.</p>}
    </section>
    {result && <section className="panel"><h2>{result.course.title}</h2><p>{result.course.goal}</p>
      <p>Target: {result.course.target}</p><p>Starting level: {result.course.assumed_level}</p>
      <p><Link href={`/library/exports/${result.course.export_id}`}>Saved Library snapshot</Link></p>
      <p>Source items without a module or exclusion: {result.unassigned.length}. This is file accounting, not a check of teaching completeness.</p>
      <ol>{result.course.modules.map(module => <li key={module.id}><h3>{module.id} · {module.title}</h3><p>{module.outcome}</p>
        <p>Prerequisites: {module.needs.join(", ") || "None"}. Estimated steps: {module.steps_estimate}.</p>
        <p>Sources: {module.sources.join(", ")}.</p><p>Independent proof: {module.proof}</p>
      </li>)}</ol>
      <details><summary>Exclusions and open questions</summary>
        <ul>{result.course.not_covered.map(item => <li key={item.id}>{item.id}: {item.why}</li>)}</ul>
        <ul>{result.course.open_questions.map((question, index) => <li key={index}>{question}</li>)}</ul>
        {!!result.unassigned.length && <p>Unassigned items: {result.unassigned.join(", ")}</p>}
      </details>
    </section>}
  </>;
}
