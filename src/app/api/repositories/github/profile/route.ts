import { createClient } from "@/lib/supabase/server";
import { listGitHubRepositories } from "@/lib/github-import";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return new Response("Sign in again before listing repositories.", { status: 401 });
  try {
    const params = new URL(request.url).searchParams;
    return Response.json(await listGitHubRepositories(params.get("url") ?? "", Number(params.get("page") ?? "1")), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return new Response(error instanceof Error ? error.message : "Could not list repositories.", { status: 400 });
  }
}
