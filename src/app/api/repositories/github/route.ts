import { createClient } from "@/lib/supabase/server";
import { downloadGitHubRepository } from "@/lib/github-import";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return new Response("Sign in again before downloading a repository.", { status: 401 });
  try {
    const form = await request.formData();
    const result = await downloadGitHubRepository(String(form.get("url") ?? ""), String(form.get("ref") ?? ""));
    return new Response(result.archive.buffer, { headers: { "Content-Type": "application/zip", "Cache-Control": "no-store",
      "X-Repository-URL": result.url, "X-Repository-Commit": result.commit, "X-Repository-Name": result.name } });
  } catch (error) {
    return new Response(error instanceof Error ? error.message : "Could not download repository.", { status: 400 });
  }
}
