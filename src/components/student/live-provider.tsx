"use client";

import { useRouter } from "next/navigation";
import { startTransition, useCallback, useEffect, useRef, useState } from "react";

interface Props {
  /** Heartbeat value the current page was rendered with. */
  rev: number;
  /** Clock-mode timetables need a periodic refresh so NOW/COMPLETE change on time. */
  refreshEveryMs?: number;
  supabase?: { url: string; anonKey: string } | null;
  pollMs?: number;
}

/**
 * Keeps a phone in sync without anyone pulling to refresh.
 *  1. Polls /api/live every few seconds (cheap, CDN-collapsed, works everywhere).
 *  2. Optionally subscribes to Supabase Realtime for near-instant pushes.
 * Either one just notices "the heartbeat moved" and re-renders the server page.
 */
export function LiveProvider({ rev, refreshEveryMs, supabase, pollMs = 5000 }: Props) {
  const router = useRouter();
  const seen = useRef(rev);
  const lastRefresh = useRef(0);
  const inflight = useRef(false);
  const [offline, setOffline] = useState(false);
  const failures = useRef(0);

  useEffect(() => {
    seen.current = rev;
  }, [rev]);

  const check = useCallback(async () => {
    if (inflight.current) return;
    inflight.current = true;
    try {
      const res = await fetch("/api/live", { cache: "no-store" });
      if (!res.ok) throw new Error("bad status");
      const data = (await res.json()) as { rev: number };
      failures.current = 0;
      setOffline(false);
      // `seen` only advances when a refreshed page arrives (rev prop changes), so a refresh
      // that fails on a bad connection is retried. The 4 s gap stops one change firing twice.
      if (data.rev !== seen.current && Date.now() - lastRefresh.current > 4000) {
        lastRefresh.current = Date.now();
        startTransition(() => router.refresh());
      }
    } catch {
      if (++failures.current >= 2) setOffline(true);
    } finally {
      inflight.current = false;
    }
  }, [router]);

  useEffect(() => {
    const tick = () => document.visibilityState === "visible" && void check();
    const id = window.setInterval(tick, pollMs);
    const wake = () => void check();
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("online", wake);
    window.addEventListener("focus", wake);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
      window.removeEventListener("online", wake);
      window.removeEventListener("focus", wake);
    };
  }, [check, pollMs]);

  useEffect(() => {
    if (!supabase) return;
    let cleanup: (() => void) | undefined;
    let debounce: number | undefined;
    let cancelled = false;
    (async () => {
      try {
        const { createClient } = await import("@supabase/supabase-js");
        if (cancelled) return;
        const client = createClient(supabase.url, supabase.anonKey, { auth: { persistSession: false } });
        const channel = client
          .channel("kac-live")
          .on("postgres_changes", { event: "*", schema: "public", table: "live_state" }, () => {
            window.clearTimeout(debounce);
            debounce = window.setTimeout(() => void check(), 250);
          })
          .subscribe();
        cleanup = () => void client.removeChannel(channel);
      } catch {
        /* Realtime is a bonus: polling keeps working. */
      }
    })();
    return () => {
      cancelled = true;
      window.clearTimeout(debounce);
      cleanup?.();
    };
  }, [supabase, check]);

  useEffect(() => {
    if (!refreshEveryMs) return;
    const id = window.setInterval(() => document.visibilityState === "visible" && startTransition(() => router.refresh()), refreshEveryMs);
    return () => window.clearInterval(id);
  }, [refreshEveryMs, router]);

  if (!offline) return null;
  return (
    <div role="status" className="fixed inset-x-0 top-0 z-50 flex justify-center px-3 pt-[max(8px,env(safe-area-inset-top))]">
      <div className="rounded-full border-2 border-ink bg-sun px-3 py-1 text-xs font-extrabold shadow-[0_3px_0_var(--ink)]">
        📶 Reconnecting… what you see may be a moment behind
      </div>
    </div>
  );
}
