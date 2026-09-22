"use client";

import { useLiveReload } from "@/components/use-live-reload";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/cn";

export interface TvTally {
  classId: number;
  className: string;
  classColor: string;
  correct: number;
  wrong: number;
}

interface Props {
  rev: number;
  questionNumber: number;
  buzzedStudentId: number | null;
  buzzedStudentName: string | null;
  className: string | null;
  classColor: string | null;
  photoUrl: string | null;
  result: "correct" | "wrong" | null;
  tally: TvTally[];
}

/** A passive, unauthenticated screen: no student or admin session, nothing to click. */
export function BuzzerBoard({ rev, questionNumber, buzzedStudentId, buzzedStudentName, className, classColor, photoUrl, result, tally }: Props) {
  useLiveReload(rev, 1500);

  return (
    <div className="app-bg min-h-dvh px-10 py-8 text-[var(--ink)]">
      <header className="mb-8">
        <div className="display text-[56px] leading-none">
          KAC <span className="text-dragon-outline">ACADEMY</span>
        </div>
        <div className="label mt-1 text-2xl tracking-[0.3em]">Social Studies</div>
      </header>

      <section className="mb-8">
        {questionNumber < 1 ? (
          <div className="card bg-white p-12 text-center">
            <div className="text-6xl">🔔</div>
            <div className="display mt-2 text-4xl">Waiting for the round to start…</div>
          </div>
        ) : buzzedStudentId === null ? (
          <div className="card bg-white p-12 text-center">
            <div className="label mb-2 text-2xl">Question {questionNumber}</div>
            <div className="text-7xl">🔔</div>
            <div className="display mt-2 text-5xl">Buzz in!</div>
          </div>
        ) : (
          <div className={cn("card overflow-hidden border-4 border-ink p-10 text-center", result === "correct" ? "bg-mint/40" : result === "wrong" ? "bg-pen/15" : "bg-sun")}>
            <div className="label mb-4 text-2xl">Question {questionNumber}</div>
            <Avatar
              student={{ id: buzzedStudentId, name: buzzedStudentName ?? "Student", photoUrl }}
              className="mx-auto h-56 w-48 rounded-2xl border-4 border-ink shadow-[0_6px_0_var(--ink)]"
            />
            <div className="display mt-5 text-7xl leading-none">{buzzedStudentName}</div>
            {className && (
              <span className="mt-3 inline-block rounded-full border-2 border-ink px-4 py-1.5 text-xl font-extrabold" style={{ background: classColor ?? "#fff" }}>
                {className}
              </span>
            )}
            {result && <div className="display mt-4 text-4xl uppercase">{result === "correct" ? "✅ Correct!" : "❌ Wrong"}</div>}
          </div>
        )}
      </section>

      {tally.length > 0 && (
        <section>
          <div className="label mb-3 text-2xl">Scoreboard</div>
          <ul className="flex flex-wrap gap-3">
            {tally.map((t) => (
              <li key={t.classId} className="flex items-center gap-2 rounded-2xl border-2 border-line bg-white px-4 py-2.5 text-xl font-bold">
                <span className="h-3.5 w-3.5 rounded-full border-2 border-ink" style={{ background: t.classColor }} />
                {t.className}
                <span className="text-emerald-700">✔{t.correct}</span>
                <span className="text-pen">✘{t.wrong}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
