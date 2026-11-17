import test from "node:test";
import assert from "node:assert/strict";
import { parseGitHubRepository, downloadGitHubRepository, GITHUB_ARCHIVE_LIMIT } from "../src/lib/github-import.ts";
import { repositoryArchiveRoot } from "../src/lib/repository-import.ts";

test("GitHub imports accept only repository-root HTTPS URLs and strip the GitHub archive wrapper", () => {
 assert.equal(parseGitHubRepository("https://github.com/example/project.git").url,"https://github.com/example/project");
 for(const url of ["http://github.com/example/project","https://github.com.evil.test/example/project","https://user:pass@github.com/example/project","https://github.com/example/project/tree/main","https://127.0.0.1/example/project","https://github.com/example/project?q=x"])
  assert.throws(()=>parseGitHubRepository(url),/GitHub|https/);
 assert.equal(repositoryArchiveRoot(["example-project-abc/src/main.py","example-project-abc/README.md"]),"example-project-abc");
 assert.equal(repositoryArchiveRoot(["a/file.py","b/file.py"]),null);
});

test("GitHub download pins a SHA, rejects unexpected hosts and enforces the streaming ZIP cap", async () => {
 const sha="a".repeat(40),requests:string[]=[];let evil=false,large=false,status=200;
 const fetcher:typeof fetch=async input=>{
  const url=String(input);requests.push(url);
  if(url.includes("/commits/"))return new Response(status===200?sha:"",{status});
  if(url.includes("/zipball/"))return new Response(null,{status:302,headers:{location:evil?"https://evil.test/archive":"https://codeload.github.com/example/project/legacy.zip/"+sha}});
  return large?new Response(new Uint8Array(GITHUB_ARCHIVE_LIMIT+1)):new Response(new Uint8Array([80,75,3,4]));
 };
 const result=await downloadGitHubRepository("https://github.com/example/project","",fetcher);
 assert.equal(result.commit,sha);assert.ok(requests[1].endsWith(sha));assert.equal(result.archive.length,4);
 requests.length=0;
 await downloadGitHubRepository("https://github.com/example/project","release/v1",fetcher);
 assert.ok(requests[0].endsWith("/commits/release%2Fv1"));
 evil=true;await assert.rejects(downloadGitHubRepository("https://github.com/example/project","",fetcher),/destination/);
 evil=false;large=true;await assert.rejects(downloadGitHubRepository("https://github.com/example/project","",fetcher),/20 MiB/);
 large=false;status=503;await assert.rejects(downloadGitHubRepository("https://github.com/example/project","",fetcher),/HTTP 503/);
 status=404;await assert.rejects(downloadGitHubRepository("https://github.com/example/project","",fetcher),/not found/);
 status=429;await assert.rejects(downloadGitHubRepository("https://github.com/example/project","",fetcher),/limited/);
});
