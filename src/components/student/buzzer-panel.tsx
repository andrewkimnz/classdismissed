"use client";

import { useEffect, useState, useTransition } from "react";
import { useCountdown } from "@/components/use-countdown";
import { useLiveReload } from "@/components/use-live-reload";
import { buzzIn } from "@/actions/buzzer";
import { cn } from "@/lib/cn";

interface Props {
  rev: number;
  questionNumber: number;
  buzzedStudentId: number | null;
  buzzedStudentName: string | null;
  className: string | null;
  result: "correct" | "wrong" | null;
  myStudentId: number;
  /** True once this question has had a first wrong answer from MY team — I can't buzz again this question. */
  lockedOut: boolean;
  /** True once this question has had a first wrong answer from ANY team — buzzing is open for a steal. */
  stealOpen: boolean;
  /** Null once buzzing is open; otherwise the moment it opens — see src/actions/buzzer.ts. */
  opensAt: string | null;
}

/** A buzzer game is all about speed, so this polls faster than the app's usual 5 s heartbeat check —
 * every 1.5 s — so "someone already buzzed" shows up almost as fast as it happens. */
export function BuzzerPanel({ rev, questionNumber, buzzedStudentId, buzzedStudentName, className, result, myStudentId, lockedOut, stealOpen, opensAt }: Props) {
  useLiveReload(rev, 1500);
  const countdown = useCountdown(opensAt);
  const [pending, start] = useTransition();
  const [flash, setFlash] = useState<string | null>(null);
  // "Too slow" / "you buzzed in first" is only meaningful for the question it was said about —
  // clear it the moment a new one opens, so it can't linger under next question's fresh BUZZ button.
  useEffect(() => setFlash(null), [questionNumber]);

  if (questionNumber < 1) {
    return (
      <div className="card bg-white p-8 text-center">
        <div className="text-5xl">🔔</div>
        <div className="display mt-2 text-2xl">Waiting for the round to start…</div>
        <p className="mt-1 text-sm text-ink-soft">Your exec will kick things off. Stay ready!</p>
      </div>
    );
  }

  if (buzzedStudentId === null && lockedOut) {
    return (
      <div className="card bg-paper-2 p-8 text-center">
        <div className="label mb-3">Question {questionNumber}</div>
        <div className="text-5xl">🙈</div>
        <div className="display mt-2 text-2xl">Your team already had a go</div>
      </div>
    );
  }

  if (buzzedStudentId === null && countdown > 0) {
    return (
      <div className="card p-6 text-center">
        <div className="label mb-3">Question {questionNumber}</div>
        <div className="pulse-ring mx-auto flex h-56 w-56 items-center justify-center rounded-full border-4 border-ink bg-sun">
          <span className="display text-7xl leading-none">{countdown}</span>
        </div>
        <p className="mt-4 text-sm font-bold text-ink-soft">Get ready — buzzing opens in a moment!</p>
      </div>
    );
  }

  if (buzzedStudentId === null) {
    return (
      <div className="card p-6 text-center">
        {stealOpen && (
          <p className="mb-3 rounded-xl border-2 border-dashed border-pen bg-pen/10 px-3 py-2 text-sm font-bold text-pen">
            🔁 Steal chance! The other team missed it.
          </p>
        )}
        <div className="label mb-3">Question {questionNumber}</div>
        <button
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await buzzIn();
              setFlash(r.ok ? (r.message ?? null) : r.error);
            })
          }
          className="mx-auto flex h-56 w-56 items-center justify-center rounded-full border-4 border-ink bg-pen text-white shadow-[0_8px_0_var(--ink)] transition-transform active:translate-y-2 active:shadow-none disabled:opacity-60"
        >
          <span className="display text-4xl">BUZZ</span>
        </button>
        {flash && <p className="mt-4 text-sm font-bold text-ink-soft">{flash}</p>}
      </div>
    );
  }

  const isMe = buzzedStudentId === myStudentId;
  let sub: string;
  if (result === "correct") {
    sub = isMe ? "Correct! Next question soon." : `Correct — ${className ?? "their team"} got the point.`;
  } else if (result === "wrong") {
    sub = isMe ? "Not quite — next question soon." : `Wrong — not ${className ?? "their team"}'s question anymore.`;
  } else {
    sub = isMe ? "Answer out loud — an exec will mark it." : "Wait for the next question.";
  }
  return (
    <div className={cn("card p-8 text-center", result === "correct" ? "bg-mint/30" : result === "wrong" ? "bg-pen/10" : "bg-sun")}>
      <div className="label mb-2">Question {questionNumber}</div>
      <div className="text-5xl">{result === "correct" ? "✅" : result === "wrong" ? "❌" : "🔔"}</div>
      <div className="display mt-2 text-3xl">{isMe ? "You buzzed in!" : `${buzzedStudentName ?? "Someone"} buzzed in first`}</div>
      {className && <p className="mt-1 text-sm font-bold text-ink-soft">{className}</p>}
      <p className="mt-3 text-sm text-ink-soft">{sub}</p>
    </div>
  );
}
