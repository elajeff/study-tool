"use client";
import Link from "next/link";
import { startTransition, useActionState, useId, useState } from "react";
import { importInbox } from "@/app/inbox-actions";
import type { ModuleImportScope } from "@/lib/inbox";

export function InboxImporter({ openCourse = false, moduleScope }: { openCourse?: boolean; moduleScope?: ModuleImportScope }) {
  const [state, action, pending] = useActionState(importInbox, null);
  const id = useId();
  const [response, setResponse] = useState(""), [fileError, setFileError] = useState("");
  const [fileName, setFileName] = useState("");
  function importFile(file: File | undefined, eventForm: HTMLFormElement | null) {
    if (!file || !eventForm) return;
    setFileName(file.name);
    if (file.size > 1024 * 1024) { setFileError("Select a response file of at most 1 MiB."); return; }
    setFileError("");
    const form = new FormData(eventForm);
    form.delete("response"); form.set("response_file", file);
    if (!moduleScope || "moduleId" in moduleScope) form.set("open_course", "true");
    startTransition(() => action(form));
  }
  return <form action={action} aria-busy={pending}>
    <input type="hidden" name="open_course" value={String(openCourse)} />
    {moduleScope && <><input type="hidden" name="course_id" value={moduleScope.courseId} />
      {"moduleId" in moduleScope ? <input type="hidden" name="module" value={moduleScope.moduleId} />
        : moduleScope.moduleIds.map(id => <input key={id} type="hidden" name="batch_module" value={id} />)}</>}
    <label htmlFor={`${id}-file`}>Import ChatGPT file</label>
    <p>Choose the downloaded JSON or text file. It is checked and saved automatically.</p>
    <input id={`${id}-file`} type="file" accept=".json,.txt,.md" disabled={pending}
      onChange={event => { importFile(event.target.files?.[0], event.target.form); event.target.value = ""; }} />
    <details><summary>Paste a response instead</summary>
      <label htmlFor={id}>ChatGPT response</label>
      <textarea id={id} name="response" className="input" rows={10} required maxLength={1048576} value={response} onChange={event => { setResponse(event.target.value); setFileError(""); setFileName(""); }} disabled={pending} />
      <p>Paste the full response, keeping its code fences. Up to 20 blocks and 1 MiB.</p>
      <button className="button button-light" disabled={pending}>{pending ? "Checking and saving…" : "Import response"}</button>
    </details>
    {pending && <p role="status">Checking and saving{fileName ? ` ${fileName}` : " your response"}… Keep this page open.</p>}
    {(fileError || state?.error) && !pending && <p role="alert">{fileError || state?.error}</p>}
    {(fileError || state?.error) && !pending && <p>Correct the reported issue, then choose the file again or paste the corrected response. Previously saved imports are kept.</p>}
    {state?.results && !pending && !fileError && <div role="status"><p>Response saved. Repeated outlines, summaries and assessments are kept without duplicates.</p>
      {!!state.ignored && <p>{state.ignored} unrelated JSON blocks ignored.</p>}
      <ul>{state.results.map((result, index) => <li key={index}>
        {result.kind === "course" || result.kind === "module" ? <Link href={{ pathname: "/courses", query: { id: result.course_id, ...(result.module ? { module: result.module } : {}) }, hash: result.module ? "module-plan" : undefined }}>{result.kind === "course" ? result.created ? "Course saved" : "Existing course kept" : `${result.module ?? "Module"} plan ready`}</Link>
          : result.kind === "digest" ? <Link href={`/library/exports/${result.export_id}`}>{result.new_items} new item summaries</Link>
            : <Link href="/assessments">{result.created ? "Assessment saved for review" : "Existing assessment kept"}</Link>}
      </li>)}</ul>
    </div>}
  </form>;
}
