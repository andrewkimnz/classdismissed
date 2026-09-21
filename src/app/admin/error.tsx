"use client";

import { adminLogout } from "@/actions/auth";
import { btnClass } from "@/components/ui/kit";

/** A crash in the staff room must never lock anyone out: keep "Try again" and "Sign out" within reach. */
export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div data-phase="school_day" className="app-bg flex min-h-dvh items-center justify-center px-5">
      <div className="card w-full max-w-sm p-5 text-center">
        <div className="text-4xl">🛠️</div>
        <h1 className="display mt-2 text-3xl">Something went wrong</h1>
        <p className="mt-1 text-sm text-ink-soft">This page couldn’t load. Try again, or sign out and back in.</p>
        <div className="mt-4 grid gap-2.5">
          <button type="button" className={btnClass("primary", "lg")} onClick={() => reset()}>Try again</button>
          <form action={adminLogout}>
            <button type="submit" className={btnClass("ghost", "lg", "w-full")}>Sign out</button>
          </form>
        </div>
        {error.digest && <p className="mt-4 text-[11px] text-ink-soft">Error code {error.digest}</p>}
      </div>
    </div>
  );
}
