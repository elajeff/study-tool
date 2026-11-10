"use client";
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function signIn(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true); setError("");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/confirm` },
    });
    setBusy(false);
    if (error) setError(error.message);
    else setSent(true);
  }
  return sent ? <div className="success-panel"><h3>Check your inbox</h3><p>We sent a sign-in link to <strong>{email}</strong>. Open it to continue.</p><button className="text-link" onClick={() => setSent(false)}>Use another email</button></div>
    : <form className="stack" onSubmit={signIn}><label htmlFor="email">Email address</label><input id="email" className="input" type="email" required autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />{error && <p role="alert" className="error-text">{error}</p>}<button className="button button-dark button-wide" disabled={busy}>{busy ? "Sending…" : "Continue with email"}<ArrowRight size={16} /></button></form>;
}
