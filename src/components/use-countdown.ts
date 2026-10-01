"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Whole seconds left until `target` (an ISO timestamp), ticking every 250ms so it lands on each
 * second cleanly; 0 once it's passed or there's no target. Used for the Buzzer fairness delay.
 *
 * The moment the countdown ends isn't a database write — nothing else tells the page to re-fetch
 * right then, so without this the Buzzer question (redacted on public reads until `opens_at`)
 * would just sit stuck on the old, redacted props until the next unrelated refresh. So this also
 * refreshes the page itself, exactly once per `target`, the instant it crosses zero.
 */
export function useCountdown(target: string | null): number {
  const router = useRouter();
  const [now, setNow] = useState(() => Date.now());
  const refreshedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!target) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [target]);

  const seconds = target ? Math.max(0, Math.ceil((new Date(target).getTime() - now) / 1000)) : 0;

  useEffect(() => {
    if (target && seconds === 0 && refreshedFor.current !== target) {
      refreshedFor.current = target;
      router.refresh();
    }
  }, [seconds, target, router]);

  return seconds;
}
