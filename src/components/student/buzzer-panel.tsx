"use client";

import { useEffect, useState, useTransition } from "react";
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
}

/** A buzzer game is all about speed, so this polls faster than the app's usual 5 s heartbeat check —
 * every 1.5 s — so "someone already buzzed" shows up almost as fast as it happens. */
export function BuzzerPanel({ rev, questionNumber, buzzedStudentId, buzzedStudentName, className, result, myStudentId }: Props) {
  useLiveReload(rev, 1500);
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

  if (buzzedStudentId === null) {
    return (
      <div className="card p-6 text-center">
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
  return (
    <div className={cn("card p-8 text-center", result === "correct" ? "bg-mint/30" : result === "wrong" ? "bg-pen/10" : "bg-sun")}>
      <div className="label mb-2">Question {questionNumber}</div>
      <div className="text-5xl">{result === "correct" ? "✅" : result === "wrong" ? "❌" : "🔔"}</div>
      <div className="display mt-2 text-3xl">{isMe ? "You buzzed in!" : `${buzzedStudentName ?? "Someone"} buzzed in first`}</div>
      {className && <p className="mt-1 text-sm font-bold text-ink-soft">{className}</p>}
      <p className="mt-3 text-sm text-ink-soft">
        {result === "correct" ? "Correct! Next question soon." : result === "wrong" ? "Not quite — next question soon." : isMe ? "Answer out loud — an exec will mark it." : "Wait for the next question."}
      </p>
    </div>
  );
}
