"use client";
import { useState } from "react";
import { portfolioMergePrompt, repositoryDraftSource, type RepositoryDraft } from "@/lib/portfolio";
import type { LibrarySource } from "@/lib/library-queries";
import { CourseLessonCard } from "./CourseLessonCard";

export function PortfolioPlanner({ exportId, repositories, drafts }: { exportId: string; repositories: LibrarySource[]; drafts: RepositoryDraft[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  let prompt = "", message = "";
  try { prompt = portfolioMergePrompt(exportId, repositories, drafts.filter(draft => selected.includes(draft.id))); }
  catch (error) { message = error instanceof Error ? error.message : "Choose repository courses."; }
  return <section className="panel"><h2>Combine repository courses</h2>
    <p>Choose one course per repository. These courses cite one repository each; check that their goals cover the project before combining them.</p>
    <p>ChatGPT reviews the selected outlines, teaches shared foundations once and returns one journey. Import it through Inbox.</p>
    {drafts.map(draft => <label key={draft.id} style={{ display: "block" }}><input type="checkbox" checked={selected.includes(draft.id)}
      onChange={event => setSelected(event.target.checked ? [...selected, draft.id] : selected.filter(id => id !== draft.id))} /> {repositoryDraftSource(repositories, draft.course)} · {draft.course.title}</label>)}
    {message && <p role="status">{message}</p>}
    {prompt && <CourseLessonCard key={selected.join(",")} text={prompt} />}
  </section>;
}
