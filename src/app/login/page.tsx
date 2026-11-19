import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { LoginForm } from "@/components/LoginForm";
import { ThemeToggle } from "@/components/ThemeToggle";

export const metadata: Metadata = { title: "Sign in" };
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <main className="auth-page">
    <div className="auth-top"><Logo href="/" /><div className="header-actions"><ThemeToggle /><Link href="/" className="text-link">Back to home</Link></div></div>
    <section className="auth-card"><h1>Sign in</h1><p className="muted">Enter your email to receive a sign-in link. An account is created on first sign-in.</p>
      {error === "signin" && <p role="alert" className="error-text">This link could not sign you in. It may have expired or been used. Request a new link and open it in the same browser.</p>}
      <LoginForm />
    </section>
    <p className="auth-hint">Your learning notes and progress are private to your account.</p>
  </main>;
}
