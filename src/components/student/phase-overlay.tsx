"use client";

import { useEffect, useState } from "react";
import { Crest } from "@/components/ui/crest";
import { Petals } from "@/components/ui/kit";

type Phase = "school_day" | "after_school" | "event_complete";
const ORDER: Phase[] = ["school_day", "after_school", "event_complete"];
const KEY = "kac.phase.seen";

/**
 * Full-screen moment when the organiser flips the phase. Shown once per phone,
 * only when moving FORWARD, including for students who open the app afterwards.
 */
export function PhaseOverlay({ phase }: { phase: Phase }) {
  const [show, setShow] = useState<Phase | null>(null);

  useEffect(() => {
    let seen: string | null = null;
    try {
      seen = localStorage.getItem(KEY);
      localStorage.setItem(KEY, phase);
    } catch {
      /* private mode: no overlay memory, which is fine */
    }
    if (seen && seen !== phase && ORDER.indexOf(phase) > ORDER.indexOf(seen as Phase)) {
      setShow(phase);
      try { navigator.vibrate?.([120, 60, 120]); } catch { /* ignore */ }
    }
  }, [phase]);

  useEffect(() => {
    if (!show) return;
    const t = window.setTimeout(() => setShow(null), 20000);
    return () => window.clearTimeout(t);
  }, [show]);

  if (!show) return null;
  const complete = show === "event_complete";
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={complete ? "Event complete" : "Class dismissed"}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden px-6 text-center"
      style={{ background: complete ? "linear-gradient(160deg,#1f2a5a,#3c4a8c 60%,#d99a0b)" : "linear-gradient(160deg,#ff8a6b,#ee4f86 55%,#8e5cf0)" }}
    >
      <Petals count={26} />
      <div className="anim-bell text-[92px] leading-none drop-shadow-lg">{complete ? "🎓" : "🔔"}</div>
      <div className="anim-pop mt-4 text-white" style={{ animationDelay: "250ms" }}>
        <div className="display text-[54px] leading-[0.95] drop-shadow-[0_4px_0_rgba(0,0,0,0.25)]">{complete ? "GRADUATION\nDAY".split("\n").map((l) => <div key={l}>{l}</div>) : "CLASS DISMISSED".split(" ").map((l) => <div key={l}>{l}</div>)}</div>
      </div>
      <p className="anim-up mt-5 text-sm font-extrabold uppercase tracking-[0.3em] text-white/90" style={{ animationDelay: "600ms" }}>
        {complete ? "The event is complete" : "The final bell has rung"}
      </p>
      <p className="anim-up display mt-2 text-3xl text-sun" style={{ animationDelay: "800ms" }}>
        {complete ? "Your keepsake is ready" : "After school is now open"}
      </p>
      <button onClick={() => setShow(null)} className="btn btn-sun btn-lg anim-up mt-8" style={{ animationDelay: "1000ms" }}>
        {complete ? "Open my keepsake" : "Enter after school"} →
      </button>
      <div className="absolute bottom-6 flex items-center gap-2 text-white/70"><Crest size={22} mono /><span className="text-xs font-bold tracking-widest">KAC ACADEMY</span></div>
    </div>
  );
}
