"use client";
import { useActionState } from "react";
import { saveCourseChat } from "@/app/course-actions";

export function CourseChatLink({ courseId, url }: { courseId: string; url: string | null }) {
  const [message, action, pending] = useActionState(saveCourseChat, "");
  return <details>
    <summary>{url ? "Edit ChatGPT conversation link" : "Save a ChatGPT conversation link"}</summary>
    <form className="stack" action={action}>
      <input type="hidden" name="course" value={courseId} />
      <label htmlFor="course-chat-url">Paste the URL from your conversation. Clear it to remove the link.</label>
      <input key={url} className="input" type="url" id="course-chat-url" name="url" defaultValue={url ?? ""} maxLength={300} />
      <button className="button button-light" disabled={pending}>{pending ? "Saving…" : "Save link"}</button>
      {message && <p role="status">{message}</p>}
    </form>
  </details>;
}
