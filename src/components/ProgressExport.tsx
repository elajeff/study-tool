"use client";
import { Download } from "lucide-react";

type Row = { title: string; path: string; level: number | null; date: string | null };

export function ProgressExport({ rows }: { rows: Row[] }) {
  function exportFile() {
    const text = [
      "# Study Tool — assessment summary", "",
      `Exported: ${new Date().toISOString()}`, "",
      "Only approved assessments are included. Not assessed is different from level 0.", "",
      ...rows.flatMap((row) => [
        `## ${row.title}`,
        `- Topic: ${row.path}`,
        `- Mastery: ${row.level === null ? "Not assessed" : `Level ${row.level}`}`,
        `- Assessed: ${row.date ?? "Never"}`,
        "",
      ]),
    ].join("\n");
    const url = URL.createObjectURL(new Blob([text], { type: "text/markdown;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "Study Tool Assessment Summary.md";
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <button type="button" className="button button-light" onClick={exportFile}>
    <Download size={16} /> Export summary
  </button>;
}
