import Link from "next/link";
import type { Metadata } from "next";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { DemoCourse } from "./demo-course";

export const metadata: Metadata = { title: "Demo course" };

export default function DemoPage() {
  return <div className="landing">
    <header className="landing-nav wrap"><Logo href="/" /><div className="header-actions"><ThemeToggle /><Link href="/" className="text-link">Back to home</Link></div></header>
    <main className="wrap demo-page">
      <div className="page-heading"><h1>Demo course</h1>
        <p>Try a sample roadmap, work through a lesson and mark it done. Progress resets when you leave or refresh.</p>
      </div>
      <DemoCourse />
    </main>
  </div>;
}
