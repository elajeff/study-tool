import type { SupabaseClient } from "@supabase/supabase-js";

export type LibrarySource = { id: string; name: string; kind: string; short_code: string };

export async function loadLibrarySources(client: SupabaseClient): Promise<LibrarySource[]> {
  const sources: LibrarySource[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await client.from("sources")
      .select("id,name,kind,short_code").order("id").range(offset, offset + 499);
    if (error) throw new Error("Could not load imported sources.");
    sources.push(...data);
    if (data.length < 500) return sources;
  }
}
