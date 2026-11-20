import { SignOutForm } from "@/components/SignOutForm";
import Link from "next/link";
import { ShieldCheck, ExternalLink, BookOpen } from "lucide-react";
import { requireAccount } from "@/lib/auth";
import { loadStudyProfile } from "@/lib/study";
import { saveStudyProfile } from "@/app/actions";

export default async function SettingsPage() {
  const { supabase, user } = await requireAccount();
  const profile = await loadStudyProfile(supabase, user.id);
  return <><div className="page-heading"><h1>Settings</h1></div>
    <div className="settings-stack">
      <section className="panel">
        <h2>Learning goals</h2>
        <form action={saveStudyProfile} className="stack">
          <label htmlFor="experience">Starting knowledge</label>
          <textarea id="experience" name="experience" className="input" rows={2} required maxLength={500} defaultValue={profile?.experience ?? ""} />
          <label htmlFor="goals">Goals</label>
          <textarea id="goals" name="goals" className="input" rows={3} required maxLength={2000} defaultValue={profile?.goals ?? ""} />
          <label htmlFor="focus">Topics or projects to prioritize (optional)</label>
          <input id="focus" name="focus" className="input" maxLength={500} defaultValue={profile?.focus ?? ""} />
          <label htmlFor="hours">Hours available per week</label>
          <input type="number" id="hours" name="hours" className="input" min={1} max={80} required defaultValue={profile?.hours_per_week ?? 5} />
          <button type="submit" className="button button-dark">Save learning goals</button>
        </form>
      </section>
      <section className="panel"><h2>Account</h2><p><strong>Email:</strong> {user.email}</p><p className="muted small">Your imported notes and progress are private to your account through database row-level security.</p><SignOutForm /></section>
      <section className="panel"><h2>AI tutors</h2><div className="setting-row"><div><strong>ChatGPT Web</strong><p>Default. Lesson context is prepared for you to paste.</p></div><a href="https://chatgpt.com/" target="_blank" rel="noreferrer" className="button button-light">Open <ExternalLink size={15} /></a></div></section>
      <section className="panel"><h2>Obsidian</h2><div className="setting-row"><div><strong>Import and export</strong><p>Import and export Markdown files. Changes are not synchronized with your vault.</p></div><Link href="/notes" className="button button-light">Notes <BookOpen size={15} /></Link></div><div className="setting-row"><div><strong>Privacy</strong><p>Study Tool does not send your private notes to AI automatically; you choose when to share lesson context.</p></div><ShieldCheck size={22} /></div></section></div>
  </>;
}
