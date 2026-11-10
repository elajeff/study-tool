"use client";
import { useState } from "react";
import JSZip from "jszip";
import { Download, FileUp, LoaderCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cleanNotePath, titleFromPath, type Note } from "@/lib/notes";

const MAX_ZIP_BYTES = 5 * 1024 * 1024;
const MAX_NOTE_BYTES = 500_000;
const MAX_NOTES = 200;

type Imported = { path: string; title: string; body: string };

export function NotesImporter({ notes }: { notes: Note[] }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function importFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true); setMessage("");
    try {
      const candidates: Imported[] = [];
      for (const file of Array.from(files)) {
        if (file.name.toLowerCase().endsWith(".zip")) {
          if (file.size > MAX_ZIP_BYTES) throw new Error("A ZIP exceeds the 5 MB import limit.");
          const zip = await JSZip.loadAsync(file);
          for (const entry of Object.values(zip.files)) {
            if (entry.dir) continue;
            const path = cleanNotePath(entry.name);
            if (!path) continue;
            if (entry._data && (entry as unknown as { _data: { uncompressedSize: number } })._data.uncompressedSize > MAX_NOTE_BYTES) continue;
            const body = await entry.async("string");
            if (new Blob([body]).size <= MAX_NOTE_BYTES) candidates.push({ path, title: titleFromPath(path), body });
            if (candidates.length > MAX_NOTES) throw new Error("Import at most 200 notes at a time.");
          }
        } else {
          const rawPath = file.webkitRelativePath || file.name;
          const path = cleanNotePath(rawPath);
          if (!path || file.size > MAX_NOTE_BYTES) continue;
          candidates.push({ path, title: titleFromPath(path), body: await file.text() });
        }
      }
      if (!candidates.length) throw new Error("No valid .md files were found.");
      if (candidates.length > MAX_NOTES) throw new Error("Import at most 200 notes at a time.");
      const unique = [...new Map(candidates.map((n) => [n.path, n])).values()];
      const collisions = unique.filter((n) => notes.some((old) => old.path === n.path));
      if (collisions.length && !window.confirm(`${collisions.length} existing notes have matching paths. Replace them with the imported versions?`)) {
        setMessage("Import canceled; no notes were changed."); return;
      }
      const supabase = createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error("Please sign in again.");
      for (let i = 0; i < unique.length; i += 25) {
        const batch = unique.slice(i, i + 25).map((n) => ({ ...n, user_id: user.id, updated_at: new Date().toISOString() }));
        const { error } = await supabase.from("notes").upsert(batch, { onConflict: "user_id,path" });
        if (error) throw new Error(`Import stopped: ${error.message}`);
      }
      setMessage(`Imported ${unique.length} note${unique.length === 1 ? "" : "s"}.`);
      window.location.reload();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Import failed."); }
    finally { setBusy(false); }
  }
  async function exportNotes() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setMessage("Please sign in again."); return; }
    const zip = new JSZip();
    let from = 0;
    while (true) {
      const { data, error } = await supabase.from("notes").select("path,body").order("path").range(from, from + 199);
      if (error) { setMessage(error.message); return; }
      for (const note of data ?? []) {
        const path = cleanNotePath(note.path);
        if (path) zip.file(path, note.body);
      }
      if (!data || data.length < 200) break;
      from += 200;
    }
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = "study-tool-notes.zip"; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <section className="import-strip"><div><h2>Use your existing notes</h2><p>Bring in an Obsidian Markdown ZIP or individual .md files. Original files stay untouched.</p></div><div className="import-actions"><label className={`button button-dark ${busy ? "disabled" : ""}`}><FileUp size={17} />{busy ? "Importing…" : "Import Markdown"}<input type="file" multiple accept=".zip,.md,text/markdown" hidden disabled={busy} onChange={(e) => { void importFiles(e.target.files); e.target.value = ""; }} /></label><button className="button button-light" type="button" onClick={() => void exportNotes()}><Download size={16} /> Export ZIP</button></div>{message && <div className="import-message" role="status">{message}</div>}</section>;
}
