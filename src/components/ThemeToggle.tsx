"use client";

import { Moon, Sun } from "lucide-react";

export function ThemeToggle({ sidebar = false }: { sidebar?: boolean }) {
  function toggle() {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("study-tool-theme", next); } catch {
      // Switching still works when the browser blocks preference storage.
    }
  }

  return <button type="button" className={`theme-toggle${sidebar ? " theme-toggle-sidebar" : ""}`}
    onClick={toggle} aria-label="Toggle color theme" title="Toggle color theme">
    <Sun size={16} className="theme-for-light" aria-hidden="true" />
    <Moon size={16} className="theme-for-dark" aria-hidden="true" />
    {sidebar && <><span className="theme-for-light">Light mode</span><span className="theme-for-dark">Dark mode</span></>}
  </button>;
}
