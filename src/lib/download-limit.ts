import type { SupabaseClient } from "@supabase/supabase-js";

export async function downloadLimit(client: SupabaseClient, kind: "repository" | "library") {
  const { data, error } = await client.rpc("allow_download", { p_kind: kind });
  if (error) return new Response("Downloads are temporarily unavailable. Try again later.", { status: 503 });
  if (!data) return new Response("Too many downloads. Wait a minute and try again.", {
    status: 429, headers: { "Retry-After": "60", "Cache-Control": "no-store" },
  });
  return null;
}
