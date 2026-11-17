"use client";
import { useActionState, useState } from "react";
import { importModule } from "@/app/module-import-actions";

export function ModuleImporter({ courseId, moduleId }: { courseId: string; moduleId: string }) {
  const [state, action, pending] = useActionState(importModule, {}), [text, setText] = useState("");
  return <form action={action} className="stack">
    <input type="hidden" name="course_id" value={courseId} /><input type="hidden" name="module_id" value={moduleId} />
    <label htmlFor="module-json">Module plan JSON</label>
    <textarea id="module-json" name="plan" className="input" rows={8} required maxLength={100000}
      value={text} onChange={event => setText(event.target.value)} />
    {state.error && <p role="alert">{state.error}</p>}
    <button className="button button-dark" disabled={pending}>{pending ? "Saving…" : "Import module plan"}</button>
  </form>;
}
