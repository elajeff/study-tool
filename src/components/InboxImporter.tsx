"use client";
import Link from "next/link";
import { useActionState, useId, useState } from "react";
import { importInbox } from "@/app/inbox-actions";

export function InboxImporter() {
  const [state, action, pending] = useActionState(importInbox, null);
  const id = useId();
  const [response, setResponse] = useState("");
  return <form action={action} aria-busy={pending}>
    <label htmlFor={id}>ChatGPT response</label>
    <textarea id={id} name="response" className="input" rows={10} required maxLength={1048576} value={response} onChange={event => setResponse(event.target.value)} disabled={pending} />
    <p>Paste the full response, keeping its code fences. Up to 20 blocks and 1 MiB.</p>
    <button className="button button-light" disabled={pending}>{pending ? "Checking and saving…" : "Import response"}</button>
    {state?.error && <p role="alert">{state.error}</p>}
    {state?.results && <div role="status"><p>Response saved. Repeated outlines, summaries and assessments are kept without duplicates.</p>
      {!!state.ignored && <p>{state.ignored} unrelated JSON blocks ignored.</p>}
      <ul>{state.results.map((result, index) => <li key={index}>
        {result.kind === "course" || result.kind === "module" ? <Link href={`/courses?id=${result.course_id}`}>{result.kind === "course" ? result.created ? "Course saved" : "Existing course kept" : "Module saved"}</Link>
          : result.kind === "digest" ? <Link href={`/library/exports/${result.export_id}`}>{result.new_items} new item summaries</Link>
            : <Link href="/assessments">{result.created ? "Assessment saved for review" : "Existing assessment kept"}</Link>}
      </li>)}</ul>
    </div>}
  </form>;
}
