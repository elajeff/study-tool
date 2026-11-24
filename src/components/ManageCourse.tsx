"use client";

import { useActionState } from "react";
import { deleteCourse, renameCourse } from "@/app/course-actions";

export function ManageCourse({ courseId, name, fromDashboard }: { courseId: string; name: string; fromDashboard?: boolean }) {
  const [renameMessage, rename, renaming] = useActionState(renameCourse, "");
  const [deleteMessage, remove, removing] = useActionState(deleteCourse, "");
  return <details className="course-options">
    <summary>Manage course</summary>
    <form className="stack" action={rename}>
      <input type="hidden" name="course" value={courseId} />
      <label htmlFor="course-name">Course name</label>
      <input className="input" id="course-name" name="name" key={name} defaultValue={name} maxLength={160} required />
      <button className="button button-accent" disabled={renaming || removing}>{renaming ? "Saving…" : "Rename course"}</button>
      {renameMessage && <p role="status">{renameMessage}</p>}
    </form>
    <details className="course-options course-delete">
      <summary>Delete course</summary>
      <form className="stack" action={remove}>
        <input type="hidden" name="course" value={courseId} />
        {fromDashboard && <input type="hidden" name="from_dashboard" value="yes" />}
        <p>This permanently deletes this course, its lesson plans, progress and lesson assessments. Your Library and ChatGPT conversation stay available.</p>
        <label><input type="checkbox" name="confirm" value="yes" required /> I want to delete this course</label>
        <button className="button button-danger" disabled={renaming || removing}>{removing ? "Deleting…" : "Delete course"}</button>
        {deleteMessage && <p role="alert">{deleteMessage}</p>}
      </form>
    </details>
  </details>;
}
