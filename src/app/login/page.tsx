import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { LoginForm } from "@/components/LoginForm";

export const metadata: Metadata = { title: "Sign in" };
export default function LoginPage() {
  return <main className="auth-page">
    <div className="auth-top"><Logo href="/" /><Link href="/" className="text-link">Back to home</Link></div>
    <section className="auth-card"><span className="eyebrow">YOUR WORKSPACE</span><h1>Pick up where you left off.</h1><p className="muted">Sign in with your email. New here? Your account will be created automatically.</p><LoginForm /></section>
    <p className="auth-hint">Your learning notes and progress are private to your account.</p>
  </main>;
}
