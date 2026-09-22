"use client";

import { useLiveReload } from "@/components/use-live-reload";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/cn";

const LETTERS = ["A", "B", "C", "D", "E", "F"];

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
  questionText: string | null;
  choices: string[] | null;
  /** Only non-null once a buzz on this question has been resolved — see src/lib/data/buzzer.ts. */
  correctIndex: number | null;
  buzzedStudentId: number | null;
  buzzedStudentName: string | null;
  className: string | null;
  classColor: string | null;
  photoUrl: string | null;
  result: "correct" | "wrong" | null;
  tally: TvTally[];
}

/** A passive, unauthenticated screen: no student or admin session, nothing to click. */
export function BuzzerBoard({
  rev, questionNumber, questionText, choices, correctIndex, buzzedStudentId, buzzedStudentName, className, classColor, photoUrl, result, tally,
}: Props) {
  useLiveReload(rev, 1500);

  return (
    <div className="app-bg min-h-dvh px-10 py-8 text-[var(--ink)]">
      <header className="mb-8">
        <div className="display text-[56px] leading-none">
          KAC <span className="text-dragon-outline">ACADEMY</span>
        </div>
        <div className="label mt-1 text-2xl tracking-[0.3em]">Social Studies</div>
      </header>

      <section className="mb-6">
        {questionNumber < 1 ? (
          <div className="card bg-white p-12 text-center">
            <div className="text-6xl">🔔</div>
            <div className="display mt-2 text-4xl">Waiting for the round to start…</div>
          </div>
        ) : questionText && choices ? (
          <div className="card bg-white p-8">
            <div className="label mb-2 text-xl">Question {questionNumber}</div>
            <div className="display text-4xl leading-tight">{questionText}</div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {choices.map((c, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl border-4 p-4 text-2xl font-extrabold transition-colors",
                    i === correctIndex ? "border-mint bg-mint/30" : "border-line bg-white",
                  )}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-ink text-lg">{LETTERS[i]}</span>
                  <span className="min-w-0 truncate">{c}</span>
                  {i === correctIndex && <span className="ml-auto text-3xl">✅</span>}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="card bg-white p-12 text-center">
            <div className="label mb-2 text-2xl">Question {questionNumber}</div>
            <div className="text-7xl">🔔</div>
            <div className="display mt-2 text-5xl">Buzz in!</div>
          </div>
        )}
      </section>

      {buzzedStudentId !== null && (
        <section className="mb-6">
          <div className={cn("card overflow-hidden border-4 border-ink p-6 text-center", result === "correct" ? "bg-mint/40" : result === "wrong" ? "bg-pen/15" : "bg-sun")}>
            <div className="flex items-center justify-center gap-5">
              <Avatar
                student={{ id: buzzedStudentId, name: buzzedStudentName ?? "Student", photoUrl }}
                className="h-32 w-28 shrink-0 rounded-2xl border-4 border-ink shadow-[0_5px_0_var(--ink)]"
              />
              <div className="text-left">
                <div className="display text-5xl leading-none">{buzzedStudentName}</div>
                {className && (
                  <span className="mt-2 inline-block rounded-full border-2 border-ink px-3 py-1 text-lg font-extrabold" style={{ background: classColor ?? "#fff" }}>
                    {className}
                  </span>
                )}
                {result && <div className="display mt-1 text-3xl uppercase">{result === "correct" ? "✅ Correct!" : "❌ Wrong"}</div>}
              </div>
            </div>
          </div>
        </section>
      )}

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
