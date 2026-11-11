import { LogOut, ExternalLink } from "lucide-react";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { WorkspaceNav } from "@/components/WorkspaceNav";
import { requireAccount } from "@/lib/auth";
import { signOut } from "@/app/actions";

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireAccount();
  return <div className="workspace">
    <aside className="sidebar"><div className="sidebar-top"><Logo /></div>
      <WorkspaceNav />
      <div className="sidebar-bottom"><ThemeToggle sidebar /><a href="https://chatgpt.com/" target="_blank" rel="noopener noreferrer"><ExternalLink size={16} /> Open ChatGPT</a><p className="account-email" title={user.email}>{user.email}</p><form action={signOut}><button type="submit"><LogOut size={16} /> Sign out</button></form></div>
    </aside>
    <div className="workspace-main"><header className="mobile-header"><div className="mobile-title-row"><Logo /><ThemeToggle /></div><WorkspaceNav compact /></header><main className="content">{children}</main></div>
  </div>;
}
