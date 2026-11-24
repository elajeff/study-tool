import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAccount } from "@/lib/auth";
import { RemoveLibraryCollection } from "@/components/RemoveLibraryCollection";

export default async function RemoveCollectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id)) notFound();
  const { supabase } = await requireAccount();
  const { data: source, error } = await supabase.from("sources").select("name,short_code").eq("id", id).maybeSingle();
  if (error) throw new Error("Could not load this collection.");
  if (!source) notFound();
  const exports: { id: string; created_at: string }[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase.rpc("library_exports_using_source", { p_source_id: id })
      .order("id").range(offset, offset + 499);
    if (error) throw new Error("Could not check which snapshots use this collection.");
    exports.push(...data);
    if (data.length < 500) break;
  }

  const courses: { id: string; name: string }[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase.rpc("library_courses_using_source", { p_source_id: id })
      .order("id").range(offset, offset + 499);
    if (error) throw new Error("Could not check which courses use this collection.");
    courses.push(...data);
    if (data.length < 500) break;
  }

  return <>
    <Link className="back-link" href={`/library?source=${source.short_code}`}>Back to Library</Link>
    <section className="panel danger-panel">
      <h1>Remove {source.name}?</h1>
      <p>This permanently removes the collection, its imported revisions and any editable notes linked to it.</p>
      {exports.length > 0 && <>
        <p>Library snapshots that will be removed</p>
        <ul>{exports.map(snapshot => <li key={snapshot.id}><Link href={`/library/exports/${snapshot.id}`}>
          {new Date(snapshot.created_at).toLocaleString("en-GB", { timeZone: "UTC" })} UTC · {snapshot.id.slice(0, 9)}
        </Link></li>)}</ul>
      </>}
      {courses.length > 0 && <>
        <p>Courses that will be removed, including their lesson plans and progress</p>
        <ul>{courses.map(course => <li key={course.id}><Link href={`/courses?id=${course.id}`}>{course.name}</Link></li>)}</ul>
      </>}
      <p>Remove downloaded files and ChatGPT uploads separately. Other snapshots may contain previously shared learning history.</p>
      <RemoveLibraryCollection sourceId={id} exportIds={exports.map(snapshot => snapshot.id)} courseIds={courses.map(course => course.id)} />
    </section>
  </>;
}
