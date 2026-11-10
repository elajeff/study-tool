"use client";
import { Download } from "lucide-react";
import type { Lesson } from "@/lib/curriculum";
import type { Progress } from "@/lib/progress";

export function ProgressExport({ progress, lessons }: { progress: Progress[]; lessons: Lesson[] }) {
  function exportFile() {
    const byId = new Map(progress.map((row) => [row.lesson_id, row]));
    const text = [
      "# Study Tool progress",
      "",
      `Exported: ${new Date().toISOString()}`,
      "",
      "This record is self-reported. It is not an independent assessment.",
      "",
      ...lessons.flatMap((lesson) => {
        const record = byId.get(lesson.id);
        return [
          `## ${lesson.title}`,
          `- [${record?.status === "completed" ? "x" : " "}] Completed exercise`,
          `- Status: ${record?.status ?? "not_started"}`,
          `- Mastery (self-assessed): ${record?.mastery ?? 0}/5`,
          `- Last updated: ${record?.updated_at ?? "never"}`,
          `- Reflection: ${(record?.reflection ?? "").replaceAll("\n", " ")}`,
          "",
        ];
      }),
    ].join("\n");
    const url = URL.createObjectURL(new Blob([text], { type: "text/markdown;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = "Study Tool Progress.md"; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <button className="button button-light" onClick={exportFile}><Download size={16} /> Export progress for Obsidian</button>;
}
