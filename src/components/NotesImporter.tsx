"use client";
import { useState } from "react";
import JSZip from "jszip";
import { Download, FileUp } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cleanNotePath, shouldImportNote, titleFromPath, vaultRoot, type Note } from "@/lib/notes";

const MAX_ZIP_BYTES = 20 * 1024 * 1024;
const MAX_TOTAL_BYTES = 35 * 1024 * 1024;
const MAX_NOTE_BYTES = 500_000;
const MAX_NOTES = 2000;

type Imported = { path: string; title: string; body: string };

export function NotesImporter({ notes }: { notes: Note[] }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function importFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true); setMessage("");
    try {
      const candidates: Imported[] = [];
      const plainFiles = Array.from(files).filter((file) => !file.name.toLowerCase().endsWith(".zip"));
      const sharedRoot = vaultRoot(plainFiles.map((file) => file.webkitRelativePath || file.name));
      let totalBytes = 0;
      for (const file of Array.from(files)) {
        if (file.name.toLowerCase().endsWith(".zip")) {
          if (file.size > MAX_ZIP_BYTES) throw new Error("A ZIP exceeds the 20 MB import limit.");
          const zip = await JSZip.loadAsync(file);
          if (Object.keys(zip.files).length > MAX_NOTES * 2) throw new Error("The archive contains too many files.");
          const root = vaultRoot(Object.keys(zip.files).filter((name) => name.toLowerCase().endsWith(".md")));
          for (const entry of Object.values(zip.files)) {
            if (entry.dir) continue;
            const name = root ? entry.name.slice(root.length + 1) : entry.name;
            const path = cleanNotePath(name);
            if (!path || !shouldImportNote(path)) continue;
            const sizeHint = (entry as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize;
            if (sizeHint !== undefined && sizeHint > MAX_NOTE_BYTES) continue;
            const body = await entry.async("string");
            const size = new Blob([body]).size;
            totalBytes += size;
            if (totalBytes > MAX_TOTAL_BYTES) throw new Error("The uncompressed notes exceed 35 MB.");
            if (size <= MAX_NOTE_BYTES) candidates.push({ path, title: titleFromPath(path), body });
            if (candidates.length > MAX_NOTES) throw new Error("Import at most 2000 notes at a time.");
          }
        } else {
          const rawPath = file.webkitRelativePath || file.name;
          const path = cleanNotePath(sharedRoot ? rawPath.slice(sharedRoot.length + 1) : rawPath);
          if (!path || !shouldImportNote(path) || file.size > MAX_NOTE_BYTES) continue;
          totalBytes += file.size;
          if (totalBytes > MAX_TOTAL_BYTES) throw new Error("The selected notes exceed 35 MB.");
          candidates.push({ path, title: titleFromPath(path), body: await file.text() });
        }
      }
      if (!candidates.length) throw new Error("No valid .md files were found.");
      if (candidates.length > MAX_NOTES) throw new Error("Import at most 2000 notes at a time.");
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
  return <section className="import-strip"><div><h2>Import notes</h2><p>Import a ZIP or individual .md files. Original files are not changed.</p></div><div className="import-actions"><label className={`button button-dark ${busy ? "disabled" : ""}`}><FileUp size={17} />{busy ? "Importing…" : "Import Markdown"}<input type="file" multiple accept=".zip,.md,text/markdown" className="import-file" disabled={busy} onChange={(e) => { void importFiles(e.target.files); e.target.value = ""; }} /></label><button className="button button-light" type="button" onClick={() => void exportNotes()}><Download size={16} /> Export ZIP</button></div>{message && <div className="import-message" role="status">{message}</div>}</section>;
}
