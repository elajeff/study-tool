"use client";
import Link from "next/link";
import { startTransition, useActionState, useId, useRef, useState } from "react";
import { importInbox } from "@/app/inbox-actions";
import type { ModuleImportScope } from "@/lib/inbox";

export function InboxImporter({ allowPaste = false, moduleScope }: { allowPaste?: boolean; moduleScope?: ModuleImportScope }) {
  const [state, action, pending] = useActionState(importInbox, null);
  const id = useId();
  const fileInput = useRef<HTMLInputElement>(null);
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
    {moduleScope && <><input type="hidden" name="course_id" value={moduleScope.courseId} />
      {"moduleId" in moduleScope ? <input type="hidden" name="module" value={moduleScope.moduleId} />
        : moduleScope.moduleIds.map(id => <input key={id} type="hidden" name="batch_module" value={id} />)}</>}
    <p className="muted small">Choose the file from ChatGPT. Study Tool checks and saves it automatically.</p>
    <button className="button button-accent" type="button" disabled={pending} onClick={() => fileInput.current?.click()}>
      Choose file
    </button>
    <input ref={fileInput} type="file" accept=".json,.txt,.md" disabled={pending} hidden
      onChange={event => { importFile(event.target.files?.[0], event.target.form); event.target.value = ""; }} />
    {allowPaste && <details className="course-options"><summary>No download? Paste the response</summary>
      <label htmlFor={id}>ChatGPT response</label>
      <textarea id={id} name="response" className="input" rows={10} required maxLength={1048576} value={response} onChange={event => { setResponse(event.target.value); setFileError(""); setFileName(""); }} disabled={pending} />
      <p>Paste the full response, keeping its code fences. Up to 20 blocks and 1 MiB.</p>
      <button className="button button-light" disabled={pending}>{pending ? "Checking and saving…" : "Import response"}</button>
    </details>}
    {pending && <p role="status">Checking and saving{fileName ? ` ${fileName}` : " your response"}… Keep this page open.</p>}
    {(fileError || state?.error) && !pending && <p role="alert">{fileError || state?.error}</p>}
    {(fileError || state?.error) && !pending && <p>Correct the reported issue, then import the corrected response.</p>}
    {state?.results && !pending && !fileError && <div role="status"><p>Response saved. Repeated outlines and summaries are kept without duplicates.</p>
      {!!state.ignored && <p>{state.ignored} unrelated JSON blocks ignored.</p>}
      <ul>{state.results.map((result, index) => <li key={index}>
        {result.kind === "digest" ? <Link href={`/library/exports/${result.export_id}`}>{result.new_items} new item summaries</Link>
          : <Link href={{ pathname: "/courses", query: { id: result.course_id, ...(result.module ? { module: result.module } : {}) }, hash: result.module ? "module-plan" : undefined }}>{result.kind === "course" ? result.created ? "Course saved" : "Existing course kept" : `${result.module ?? "Module"} plan ready`}</Link>}
      </li>)}</ul>
    </div>}
  </form>;
}
