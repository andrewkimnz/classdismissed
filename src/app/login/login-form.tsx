"use client";

import { useActionState } from "react";
import { studentLogin, type FormState } from "@/actions/auth";

export function LoginForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(studentLogin, {});
  return (
    <form action={action} className="space-y-3">
      <label className="sr-only" htmlFor="code">Student code</label>
      <input
        id="code" name="code" required autoComplete="off" autoCapitalize="characters" autoCorrect="off" spellCheck={false}
        inputMode="text" maxLength={12} placeholder="ABC-123"
        className="field display text-center text-[34px] uppercase tracking-[0.2em]"
        style={{ minHeight: 68 }}
      />
      {state.error && <p role="alert" className="rounded-xl border-2 border-pen bg-pen/10 p-2.5 text-sm font-bold text-pen">{state.error}</p>}
      <button className="btn btn-primary btn-lg w-full" disabled={pending}>{pending ? "Checking…" : "Sign in →"}</button>
    </form>
  );
}
