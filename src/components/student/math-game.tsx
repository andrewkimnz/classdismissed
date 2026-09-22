"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitMathAnswer } from "@/actions/math";
import { TOSS_WINDOW_MS } from "@/lib/domain/math";
import { cn } from "@/lib/cn";

const WIN_STREAK = 3;

interface Props {
  status: "playing" | "ready";
  streak: number;
  question: string | null;
  /** Set only while `status === "ready"`: when the current toss window opened. */
  wonAt: string | null;
  tosses: number;
}

/**
 * The question + streak dots, or (while `status === "ready"`) the "go toss it" countdown. A
 * right/wrong answer runs `submitMathAnswer`, which — like every server action here — revalidates
 * the page, so the parent server component re-renders with the next question and streak straight
 * from the database. `flash` is purely local, ephemeral feedback on top of that, not the source of truth.
 */
export function MathGame({ status, streak, question, wonAt, tosses }: Props) {
  const [pending, start] = useTransition();
  const [value, setValue] = useState("");
  const [flash, setFlash] = useState<"correct" | "wrong" | null>(null);
  // A stale "Correct!" from the winning answer must not still be showing under the FIRST new
  // question once the toss window auto-expires and hands over a fresh one.
  useEffect(() => setFlash(null), [question]);

  if (status === "ready" && wonAt) return <TossWindow wonAt={wonAt} tosses={tosses} />;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim() || pending) return;
    const answer = Number(value);
    setValue("");
    start(async () => {
      const r = await submitMathAnswer({ answer });
      setFlash(r.ok ? (r.data?.correct ? "correct" : "wrong") : null);
    });
  };

  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="label">3 in a row to win a toss</div>
        <div className="flex gap-1.5" aria-label={`${streak} of ${WIN_STREAK} correct in a row`}>
          {Array.from({ length: WIN_STREAK }, (_, i) => (
            <span key={i} className={cn("h-3 w-3 rounded-full border-2 border-ink", i < streak ? "bg-mint" : "bg-white")} />
          ))}
        </div>
      </div>
      {flash && (
        <p className={cn("mb-3 rounded-xl border-2 p-2 text-center text-sm font-bold", flash === "correct" ? "border-mint bg-mint/15 text-emerald-700" : "border-pen bg-pen/10 text-pen")}>
          {flash === "correct" ? "Correct!" : "Not quite — try this one."}
        </p>
      )}
      <div className="display mb-4 text-center text-[40px] leading-none tabular">{question}</div>
      <form onSubmit={submit} className="flex gap-2">
        <input
          className="field flex-1 text-center text-xl"
          inputMode="numeric"
          pattern="[0-9]*"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="?"
          autoFocus
          required
          disabled={pending}
        />
        <button className="btn btn-primary" disabled={pending || !value.trim()}>{pending ? "…" : "Go"}</button>
      </form>
    </div>
  );
}

function secondsLeft(wonAt: string): number {
  return Math.max(0, Math.ceil((TOSS_WINDOW_MS - (Date.now() - new Date(wonAt).getTime())) / 1000));
}

/**
 * The "you can toss!" screen: counts down out loud, then refreshes itself so the parent re-renders
 * with a new question. The server, not this timer, is what actually decides the window is over
 * (small clock skew is normal), so this keeps retrying — at most once a second — until the props it
 * was given actually change. If even that never fires (tab was backgrounded, JS didn't run), just
 * reopening /math self-heals: the page's own read applies the same check on the way in.
 */
function TossWindow({ wonAt, tosses }: { wonAt: string; tosses: number }) {
  const router = useRouter();
  const [left, setLeft] = useState(() => secondsLeft(wonAt));

  useEffect(() => {
    let lastRefresh = 0;
    const tick = () => {
      setLeft(secondsLeft(wonAt));
      const overBy = Date.now() - new Date(wonAt).getTime() - TOSS_WINDOW_MS;
      if (overBy >= 0 && Date.now() - lastRefresh > 1000) {
        lastRefresh = Date.now();
        router.refresh();
      }
    };
    const id = setInterval(tick, 200);
    tick();
    return () => clearInterval(id);
  }, [wonAt, router]);

  return (
    <div className="card overflow-hidden bg-sun p-5 text-center">
      <div className="text-5xl">🏆</div>
      <div className="display mt-1 text-2xl">You can toss!</div>
      <div className="display my-3 text-[56px] leading-none tabular">{left}</div>
      <div className="h-2.5 overflow-hidden rounded-full border-2 border-ink bg-white/60">
        <div className="h-full bg-ink transition-[width] duration-[5000ms] ease-linear" style={{ width: left === Math.ceil(TOSS_WINDOW_MS / 1000) ? "100%" : "0%" }} />
      </div>
      {tosses > 0 && <p className="mt-3 text-xs font-bold text-ink-soft">Toss #{tosses + 1} this round 🎉</p>}
    </div>
  );
}
