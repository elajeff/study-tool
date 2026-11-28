"use client";
import { useState } from "react";
import { portfolioMergePrompt, repositoryDraftSource, type RepositoryDraft } from "@/lib/portfolio";
import type { LibrarySource } from "@/lib/library-queries";
import { CourseLessonCard } from "./CourseLessonCard";

export function PortfolioPlanner({ exportId, repositories, drafts }: { exportId: string; repositories: LibrarySource[]; drafts: RepositoryDraft[] }) {
  const [selected, setSelected] = useState<Record<string, string>>({});
  const draftsWithRepository = drafts.map(draft => ({ ...draft, repository: repositoryDraftSource(repositories, draft.course) }));
  const selectedIds = new Set(Object.values(selected));
  let prompt = "", message = "";
  if (repositories.every(repository => selected[repository.short_code])) {
    try { prompt = portfolioMergePrompt(exportId, repositories, drafts.filter(draft => selectedIds.has(draft.id))); }
    catch (error) { message = error instanceof Error ? error.message : "Could not prepare the combined course request."; }
  }
  return <section className="panel"><h2>Combine repository courses</h2>
    <p>Choose one course per repository. These courses cite one repository each; check that their goals cover the project before combining them.</p>
    <p>ChatGPT reviews the selected outlines, teaches shared foundations once and returns one journey. Import it through Inbox.</p>
    <div className="stack">{repositories.map(repository => {
      const code = repository.short_code;
      const options = draftsWithRepository.filter(draft => draft.repository === code);
      if (!options.length) return <p key={code}>Import a draft for {repository.name} to include it.</p>;
      return <label key={code}>{repository.name}
        <select className="input" value={selected[code] ?? ""}
          onChange={event => setSelected({ ...selected, [code]: event.target.value })}>
          <option value="">Choose a course draft</option>
          {options.map(draft => <option key={draft.id} value={draft.id}>{draft.course.title}</option>)}
        </select>
      </label>;
    })}</div>
    {message && <p role="status">{message}</p>}
    {prompt && <CourseLessonCard key={repositories.map(repository => selected[repository.short_code]).join(",")} text={prompt} />}
  </section>;
}
