import Link from "next/link";
import { ArrowRight, BookOpen, CheckCircle2, FileText, MessageSquare, Sparkles } from "lucide-react";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function HomePage() {
  return <div className="landing">
    <header className="landing-nav wrap"><Logo href="/" /><div className="header-actions"><ThemeToggle /><Link href="/login" className="button button-dark">Sign in <ArrowRight size={16} /></Link></div></header>
    <main className="wrap">
      <div className="hero">
        <h1>Study Tool</h1>
        <p>Import Markdown notes, organize study topics, and track progress through approved assessments.</p>
        <div className="hero-actions"><Link className="button button-dark button-large" href="/login">Sign in <ArrowRight size={18} /></Link><a className="button button-light button-large" href="#how">Features</a></div>
        <div className="hero-foot"><CheckCircle2 size={16} /> No AI API key required.</div>
      </div>
      <section className="feature-section" id="how">
        <div><h2>Features</h2></div>
        <div className="feature-grid">
          {[
            { icon: BookOpen, title: "Curriculum", description: "Study topics and prerequisite links drawn from imported notes." },
            { icon: MessageSquare, title: "Tutor handoffs", description: "Copy lesson context to ChatGPT Web or Codex." },
            { icon: FileText, title: "Markdown notes", description: "Import, edit, link, and export Markdown notes." },
            { icon: Sparkles, title: "Assessments", description: "Only approved assessment receipts affect mastery. Reading a lesson does not count." },
          ].map(({ icon: Icon, title, description }) => <article key={title} className="feature-card"><span className="feature-icon"><Icon size={22} /></span><h3>{title}</h3><p>{description}</p></article>)}
        </div>
      </section>
    </main>
    <footer className="wrap landing-footer"><Logo href="/" /><span>Open-source programming study tool</span></footer>
  </div>;
}
