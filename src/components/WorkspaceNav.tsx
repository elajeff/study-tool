"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, ChartNoAxesCombined, ClipboardCheck, FileText, Settings } from "lucide-react";

const links = [
  { href: "/dashboard", label: "Dashboard", mobileLabel: "Home", icon: ChartNoAxesCombined },
  { href: "/curriculum", label: "Curriculum", mobileLabel: "Topics", icon: BookOpen },
  { href: "/notes", label: "Notes", mobileLabel: "Notes", icon: FileText },
  { href: "/assessments", label: "Assessments", mobileLabel: "Reviews", icon: ClipboardCheck },
  { href: "/settings", label: "Settings", mobileLabel: "Settings", icon: Settings },
];

export function WorkspaceNav({ compact = false }: { compact?: boolean }) {
  const pathname = usePathname();
  return <nav className={compact ? "mobile-nav" : "side-nav"} aria-label="Main navigation">
    {links.map(({ href, label, mobileLabel, icon: Icon }) => <Link key={href} href={href}
      aria-current={pathname === href || pathname.startsWith(`${href}/`) ? "page" : undefined}>
      {!compact && <Icon size={17} strokeWidth={1.8} />}{compact ? mobileLabel : label}
    </Link>)}
  </nav>;
}
