import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { LoginForm } from "@/components/LoginForm";
import { ThemeToggle } from "@/components/ThemeToggle";

export const metadata: Metadata = { title: "Sign in" };
export default function LoginPage() {
  return <main className="auth-page">
    <div className="auth-top"><Logo href="/" /><div className="header-actions"><ThemeToggle /><Link href="/" className="text-link">Back to home</Link></div></div>
    <section className="auth-card"><h1>Sign in</h1><p className="muted">Enter your email to receive a sign-in link. An account is created on first sign-in.</p><LoginForm /></section>
    <p className="auth-hint">Your learning notes and progress are private to your account.</p>
  </main>;
}
