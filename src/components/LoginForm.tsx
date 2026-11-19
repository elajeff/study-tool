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
    try {
      const { error } = await createClient().auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: `${window.location.origin}/auth/confirm` },
      });
      if (!error) setSent(true);
      else if (error.status === 429) setError("Too many sign-in requests. Wait a moment before trying again.");
      else if (error.code === "email_address_not_authorized") setError("Sign-in email delivery is limited to the Study Tool team for now.");
      else setError("Could not send a sign-in link. Check your email address and try again.");
    } catch {
      setError("Could not reach the sign-in service. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }
  return sent ? <div className="success-panel"><h3>Check your email</h3><p>Open the sign-in link sent to <strong>{email}</strong> in this browser. Check spam if it does not arrive.</p><button className="text-link" onClick={() => setSent(false)}>Request a new link or change email</button></div>
    : <form className="stack" onSubmit={signIn}><label htmlFor="email">Email address</label><input id="email" className="input" type="email" required autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />{error && <p role="alert" className="error-text">{error}</p>}<button className="button button-dark button-wide" disabled={busy}>{busy ? "Sending…" : "Send sign-in link"}<ArrowRight size={16} /></button></form>;
}
