"use client";
import { useActionState } from "react";
import { LogOut } from "lucide-react";
import { signOut } from "@/app/actions";

export function SignOutForm({ sidebar = false }: { sidebar?: boolean }) {
  const [error, action, pending] = useActionState(signOut, "");
  return <form action={action}>
    <button type="submit" className={sidebar ? undefined : "button button-light"} disabled={pending}>
      {sidebar && <LogOut size={16} />} {pending ? "Signing out…" : "Sign out"}
    </button>
    {error && <p role="alert">{error}</p>}
  </form>;
}
