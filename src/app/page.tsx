import Link from "next/link";
import { ArrowRight, BookOpen, CheckCircle2, FileText, MessageSquare } from "lucide-react";
import { Logo } from "@/components/Logo";
import { LandingHeader } from "@/components/LandingHeader";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await createClient();
  // Session presence only changes this link; protected routes verify the user.
  const { data: { session } } = await supabase.auth.getSession();
  const href = session ? "/dashboard" : "/login";
  const label = session ? "Dashboard" : "Sign in";
  return <div className="landing">
    <LandingHeader href={href} label={label} />
    <main className="wrap">
      <div className="hero">
        <h1>Study Tool</h1>
        <p>Use your notes, conversations and repositories to build a course in ChatGPT and track your progress in Study Tool.</p>
        <div className="hero-actions"><Link id="landing-primary-action" className="button button-dark button-large" href={href}>{label} <ArrowRight size={18} /></Link><Link className="button button-light button-large" href="/demo">Try the demo</Link></div>
        <div className="hero-foot"><CheckCircle2 size={16} /> No AI API key required.</div>
      </div>
      <section className="feature-section" id="how">
        <div><h2>Features</h2></div>
        <div className="feature-grid">
          {[
            { icon: BookOpen, title: "Courses", description: "Save the course outline and first lesson plan in one import." },
            { icon: MessageSquare, title: "ChatGPT tutor", description: "Start studying in the chat that created your course." },
            { icon: FileText, title: "Study Library", description: "Organize notes, exported conversations and repository files for ChatGPT." },
          ].map(({ icon: Icon, title, description }) => <article key={title} className="feature-card"><span className="feature-icon"><Icon size={22} /></span><h3>{title}</h3><p>{description}</p></article>)}
        </div>
      </section>
    </main>
    <footer className="wrap landing-footer"><Logo href="/" /><span>Open-source programming study tool</span></footer>
  </div>;
}
