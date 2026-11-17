"use client";
import { useActionState, useState } from "react";
import { importCourse } from "@/app/course-import-actions";

export function CourseImporter() {
  const [state, action, pending] = useActionState(importCourse, {});
  const [text, setText] = useState("");
  return <form action={action} className="stack">
    <label htmlFor="course-json">Course JSON</label>
    <textarea id="course-json" name="course" className="input" rows={8} required maxLength={300000}
      value={text} onChange={event => setText(event.target.value)} />
    {state.error && <p role="alert">{state.error}</p>}
    <button className="button button-dark" disabled={pending}>{pending ? "Saving…" : "Import course"}</button>
  </form>;
}
