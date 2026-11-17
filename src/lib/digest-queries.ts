import type { SupabaseClient } from "@supabase/supabase-js";
import type { LibraryDigest } from "./library-digest.ts";

export async function loadLibraryDigests(client: SupabaseClient, revisionIds: string[]): Promise<LibraryDigest[]> {
  const records: LibraryDigest[] = [];
  for (let start = 0; start < revisionIds.length; start += 100) {
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await client.from("source_digests").select("id,revision_id,path,context,summary")
        .in("revision_id", revisionIds.slice(start, start + 100)).order("created_at", { ascending: false }).order("id").range(offset, offset + 499);
      if (error) throw new Error("Could not load saved digests. Check migration 015.");
      records.push(...data as LibraryDigest[]);
      if (data.length < 500) break;
    }
  }
  return records;
}
