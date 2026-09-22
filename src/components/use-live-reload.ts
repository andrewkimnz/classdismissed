"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * Polls `/api/live` every `intervalMs` and refreshes the page's server components when the heartbeat
 * has moved — for screens that want faster updates than the app's usual 5 s check (a live buzzer or
 * toss game, a TV display). `rev` is whatever heartbeat value the page was last rendered with; pass
 * the prop straight through and this takes care of the rest.
 */
export function useLiveReload(rev: number, intervalMs = 2000) {
  const router = useRouter();
  const seen = useRef(rev);

  useEffect(() => {
    seen.current = rev;
  }, [rev]);

  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const res = await fetch("/api/live", { cache: "no-store" });
        const data = (await res.json()) as { rev: number };
        if (data.rev !== seen.current) router.refresh();
      } catch {
        /* try again next tick */
      }
    }, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, router]);
}
