import Link from "next/link";
import { BookOpen, ChartNoAxesCombined, FileText, ClipboardCheck, LogOut, Settings, ExternalLink } from "lucide-react";
import { Logo } from "@/components/Logo";
import { requireAccount } from "@/lib/auth";
import { signOut } from "@/app/actions";

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireAccount();
  return <div className="workspace">
    <aside className="sidebar"><div className="sidebar-top"><Logo /></div>
      <div className="sidebar-label">WORKSPACE</div>
      <nav className="side-nav" aria-label="Main navigation">
        <Link href="/dashboard"><ChartNoAxesCombined size={19} /> Dashboard</Link>
        <Link href="/curriculum"><BookOpen size={19} /> Curriculum</Link>
        <Link href="/notes"><FileText size={19} /> My notes</Link>
        <Link href="/assessments"><ClipboardCheck size={19} /> Assessments</Link>
        <Link href="/settings"><Settings size={19} /> Settings</Link>
      </nav>
      <div className="sidebar-bottom"><a href="https://chatgpt.com/" target="_blank" rel="noopener noreferrer"><ExternalLink size={16} /> Open ChatGPT</a><p className="account-email" title={user.email}>{user.email}</p><form action={signOut}><button type="submit"><LogOut size={16} /> Sign out</button></form></div>
    </aside>
    <div className="workspace-main"><div className="mobile-header"><Logo /><span className="mobile-actions"><Link href="/dashboard">Home</Link><Link href="/curriculum">Learn</Link><Link href="/notes">Notes</Link><Link href="/assessments">Reviews</Link><Link href="/settings">More</Link></span></div><main className="content">{children}</main></div>
  </div>;
}
