"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";

export function LandingHeader({ href, label }: { href: string; label: string }) {
  const header = useRef<HTMLElement>(null);
  const action = useRef<HTMLAnchorElement>(null);
  const [showAction, setShowAction] = useState(false);

  useEffect(() => {
    const primary = document.getElementById("landing-primary-action");
    if (!primary || !header.current) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && document.activeElement === action.current) {
        primary.focus({ preventScroll: true });
      }
      setShowAction(!entry.isIntersecting);
    }, { rootMargin: `-${header.current.offsetHeight}px 0px 0px 0px` });
    observer.observe(primary);
    return () => observer.disconnect();
  }, []);

  return <header ref={header} className="landing-nav wrap">
    <Logo href="/" />
    <div className="header-actions"><ThemeToggle />
      <Link ref={action} href={href} className={`button button-dark${showAction ? "" : " landing-action-hidden"}`}>
        {label} <ArrowRight size={16} />
      </Link>
    </div>
  </header>;
}
