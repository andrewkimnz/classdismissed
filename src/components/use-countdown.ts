"use client";

import { useEffect, useState } from "react";

/** Whole seconds left until `target` (an ISO timestamp), ticking every 250ms so it lands on each
 * second cleanly; 0 once it's passed or there's no target. Used for the Buzzer fairness delay. */
export function useCountdown(target: string | null): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!target) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [target]);

  if (!target) return 0;
  return Math.max(0, Math.ceil((new Date(target).getTime() - now) / 1000));
}
