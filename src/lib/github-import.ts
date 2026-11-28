export const GITHUB_ARCHIVE_LIMIT = 20 * 1024 * 1024;

export type GitHubPublicRepository = { name: string; url: string; description: string | null; fork: boolean; archived: boolean };

export function parseGitHubProfile(raw: string) {
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error("Enter a public GitHub profile URL."); }
  const match = url.pathname.match(/^\/([a-z0-9-]{1,39})\/?$/i);
  if (url.protocol !== "https:" || url.hostname !== "github.com" || url.port || url.username || url.password || url.search || url.hash || !match)
    throw new Error("Use https://github.com/username without a repository path or query.");
  return match[1];
}

export async function listGitHubRepositories(raw: string, page: number, fetcher: typeof fetch = fetch) {
  const owner = parseGitHubProfile(raw);
  if (!Number.isSafeInteger(page) || page < 1) throw new Error("Invalid repository list page.");
  const response = await fetcher(`https://api.github.com/users/${owner}/repos?type=owner&sort=full_name&per_page=100&page=${page}`, {
    headers: { Accept: "application/vnd.github+json", "User-Agent": "Study-Tool", "X-GitHub-Api-Version": "2026-03-10" },
    redirect: "error", signal: AbortSignal.timeout(30000), cache: "no-store",
  });
  if (response.status === 404) throw new Error("GitHub profile not found.");
  if (response.status === 403 || response.status === 429) throw new Error("GitHub limited this public request. Try later or import a ZIP.");
  if (!response.ok) throw new Error(`Could not list repositories (HTTP ${response.status}).`);
  const items: { name: string; full_name: string; private: boolean; description: string | null; fork: boolean; archived: boolean }[] = await response.json();
  const repositories: GitHubPublicRepository[] = items.filter(item => !item.private).map(item => ({
    name: item.full_name, url: parseGitHubRepository(`https://github.com/${item.full_name}`).url,
    description: item.description, fork: item.fork, archived: item.archived,
  }));
  return { repositories, nextPage: items.length === 100 ? page + 1 : null };
}

export function parseGitHubRepository(raw: string) {
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error("Enter a public GitHub repository URL."); }
  const match = url.pathname.match(/^\/([a-z0-9-]{1,100})\/([a-z0-9_.-]{1,100})\/?$/i);
  if (url.protocol !== "https:" || url.hostname !== "github.com" || url.port || url.username || url.password || url.search || url.hash
    || !match || [".", ".."].includes(match[2])) throw new Error("Use https://github.com/owner/repository without a file path or query.");
  const repository = match[2].replace(/\.git$/, "");
  if (!repository || [".", ".."].includes(repository)) throw new Error("Enter a repository name.");
  return { owner: match[1], repository, url: `https://github.com/${match[1]}/${repository}` };
}

export async function downloadGitHubRepository(raw: string, ref: string, fetcher: typeof fetch = fetch) {
  const repository = parseGitHubRepository(raw);
  if (ref.length > 200 || /[\x00-\x1f\x7f]/.test(ref)) throw new Error("Use a branch, tag or commit of at most 200 characters.");
  const base = `https://api.github.com/repos/${repository.owner}/${repository.repository}`;
  const headers = { Accept: "application/vnd.github+json", "User-Agent": "Study-Tool", "X-GitHub-Api-Version": "2026-03-10" };
  const options = { headers, redirect: "error" as const, signal: AbortSignal.timeout(30000) };
  const commitResponse = await fetcher(`${base}/commits/${encodeURIComponent(ref.trim() || "HEAD")}`, { ...options, headers: { ...headers, Accept: "application/vnd.github.sha" } });
  if (!commitResponse.ok) {
    if (commitResponse.status === 403 || commitResponse.status === 429)
      throw new Error("GitHub refused or limited this public request. Try later or import a ZIP.");
    if (commitResponse.status === 404)
      throw new Error("Public repository or revision not found. Private repositories are not supported by URL.");
    throw new Error(`GitHub could not resolve the revision (HTTP ${commitResponse.status}). Try again or import a ZIP.`);
  }
  const commit = (await commitResponse.text()).trim();
  if (!/^[a-f0-9]{40}$/i.test(commit)) throw new Error("GitHub did not return a fixed commit.");
  const archiveResponse = await fetcher(`${base}/zipball/${commit}`, { ...options, redirect: "manual" });
  const location = archiveResponse.headers.get("location");
  if (archiveResponse.status !== 302 || !location) throw new Error("GitHub did not provide a repository archive.");
  const target = new URL(location);
  if (target.protocol !== "https:" || target.hostname !== "codeload.github.com" || target.port || target.username || target.password)
    throw new Error("GitHub returned an unexpected download destination.");
  const response = await fetcher(target.href, options);
  if (!response.ok || !response.body) throw new Error("Could not download this public repository.");
  if (Number(response.headers.get("content-length")) > GITHUB_ARCHIVE_LIMIT) { await response.body.cancel(); throw new Error("Repository ZIP exceeds the 20 MiB limit."); }
  const reader = response.body.getReader(), chunks: Uint8Array[] = [];
  let bytes = 0;
  for (;;) {
    const next = await reader.read(); if (next.done) break;
    bytes += next.value.byteLength;
    if (bytes > GITHUB_ARCHIVE_LIMIT) { await reader.cancel(); throw new Error("Repository ZIP exceeds the 20 MiB limit."); }
    chunks.push(next.value);
  }
  const archive = new Uint8Array(bytes); let offset = 0;
  for (const chunk of chunks) { archive.set(chunk, offset); offset += chunk.byteLength; }
  return { archive, url: repository.url, commit };
}
