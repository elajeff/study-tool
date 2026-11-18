"use client";
import { useState } from "react";

export function CourseLessonCard({ text, label = "Copy request for ChatGPT" }: { text: string; label?: string }) {
  const [status, setStatus] = useState("");
  async function copy() {
    try { await navigator.clipboard.writeText(text); setStatus("Copied."); }
    catch { setStatus("Clipboard unavailable. Copy the text below."); }
  }
  return <>
    <p>Copy this request and paste it into the ChatGPT conversation containing your Study Library. Nothing is sent automatically.</p>
    <div className="import-actions"><button type="button" className="button button-dark" onClick={copy}>{label}</button>
      <a className="button button-light" href="https://chatgpt.com/" target="_blank" rel="noopener noreferrer">Open ChatGPT</a></div>
    <p role="status">{status}</p>
    <details><summary>Request text</summary><textarea aria-label="Request text" className="input" readOnly rows={12} value={text} /></details>
  </>;
}
