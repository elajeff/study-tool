import Link from "next/link";
import { ArrowRight, BookOpen, CheckCircle2, FileText, MessageSquare, Sparkles } from "lucide-react";
import { Logo } from "@/components/Logo";

export default function HomePage() {
  return <div className="landing">
    <header className="landing-nav wrap"><Logo href="/" /><Link href="/login" className="button button-dark">Get started <ArrowRight size={16} /></Link></header>
    <main className="wrap">
      <div className="hero">
        <div className="eyebrow"><span className="dot" /> An open learning workspace</div>
        <h1>Learn to build things.<br /><em>Actually understand them.</em></h1>
        <p>One place to turn your own notes and goals into a study roadmap, practice, and track real progress. Use ChatGPT for everyday lessons and Codex when you need deeper coding help.</p>
        <div className="hero-actions"><Link className="button button-dark button-large" href="/login">Start learning <ArrowRight size={18} /></Link><a className="button button-light button-large" href="#how">See how it works</a></div>
        <div className="hero-foot"><CheckCircle2 size={16} /> Your notes stay yours. No AI API key needed to start.</div>
      </div>
      <section className="feature-section" id="how">
        <div><span className="eyebrow">A straightforward workflow</span><h2>Everything you need to keep moving.</h2><p className="muted">No complicated agent setup. Import your notes, choose a topic, practice it, and keep a record of what you can really do.</p></div>
        <div className="feature-grid">
          {[
            { icon: BookOpen, title: "A clear roadmap", description: "Build your own roadmap from imported concepts, linked prerequisites and personal goals." },
            { icon: MessageSquare, title: "Your choice of tutor", description: "ChatGPT Web by default. Switch to Codex for coding-heavy tasks with an intentional handoff." },
            { icon: FileText, title: "Connected notes", description: "Bring in Markdown from Obsidian, find linked concepts, and export your notes again." },
            { icon: Sparkles, title: "Honest progress", description: "Track exercises, reflections, and self-assessed mastery. Reading a lesson isn't proof of mastery." },
          ].map(({ icon: Icon, title, description }) => <article key={title} className="feature-card"><span className="feature-icon"><Icon size={22} /></span><h3>{title}</h3><p>{description}</p></article>)}
        </div>
      </section>
      <section className="cta-banner"><div><span className="eyebrow">Start small. Keep improving.</span><h2>One lesson at a time.</h2><p>Start with the fundamentals and build toward projects you can explain and maintain.</p></div><Link className="button button-white" href="/login">Create your workspace <ArrowRight size={17} /></Link></section>
    </main>
    <footer className="wrap landing-footer"><Logo href="/" /><span>Study Tool · Open-source learning workspace</span></footer>
  </div>;
}
