"use client";

import { useActionState } from "react";
import { adminLogin, type FormState } from "@/actions/auth";

export function AdminLoginForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(adminLogin, {});
  return (
    <form action={action} className="space-y-3">
      <label className="block"><span className="label mb-1 block">Email</span><input name="email" type="email" required autoComplete="username" className="field" /></label>
      <label className="block"><span className="label mb-1 block">Password</span><input name="password" type="password" required autoComplete="current-password" className="field" /></label>
      {state.error && <p role="alert" className="rounded-xl border-2 border-pen bg-pen/10 p-2.5 text-sm font-bold text-pen">{state.error}</p>}
      <button className="btn btn-ink w-full" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button>
    </form>
  );
}
