"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TOSS_WINDOW_MS } from "@/lib/domain/math";
import { cn, readableOn } from "@/lib/cn";

export interface TvWaitingEntry {
  id: number;
  name: string;
  className: string | null;
  classColor: string | null;
  wonAt: string;
}

export interface TvHistoryEntry {
  id: number;
  name: string;
  className: string | null;
  classColor: string | null;
  tosses: number;
  lastTossedAt: string | null;
}

interface Props {
  rev: number;
  waiting: TvWaitingEntry[];
  history: TvHistoryEntry[];
  nowClasses: { id: number; name: string; color: string }[];
}

/**
 * A passive, unauthenticated screen: no student or admin session, nothing to click. It watches the
 * same heartbeat every phone does (poll /api/live, refresh on change) and separately re-renders once
 * a second on its own so each waiting card's countdown ticks smoothly between polls.
 */
export function TvBoard({ rev, waiting, history, nowClasses }: Props) {
  const router = useRouter();
  const [, setTick] = useState(0);

  useEffect(() => {
    const poll = setInterval(async () => {
      try {
        const res = await fetch("/api/live", { cache: "no-store" });
        const data = (await res.json()) as { rev: number };
        if (data.rev !== rev) router.refresh();
      } catch {
        /* try again next tick */
      }
    }, 2000);
    const clock = setInterval(() => setTick((t) => t + 1), 1000);
    return () => {
      clearInterval(poll);
      clearInterval(clock);
    };
  }, [rev, router]);

  return (
    <div className="app-bg min-h-dvh px-10 py-8 text-[var(--ink)]">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <div className="display text-[56px] leading-none">
            KAC <span className="text-dragon-outline">ACADEMY</span>
          </div>
          <div className="label mt-1 text-2xl tracking-[0.3em]">Maths toss challenge</div>
        </div>
        <div className="text-right">
          <div className="label text-xl">Live at the Maths table{nowClasses.length !== 1 ? "s" : ""}</div>
          <div className="mt-1 flex flex-wrap justify-end gap-2">
            {nowClasses.length === 0 ? (
              <span className="rounded-full border-2 border-line bg-white px-4 py-1.5 text-lg font-bold text-ink-soft">Nobody's in Maths right now</span>
            ) : (
              nowClasses.map((c) => (
                <span key={c.id} className="rounded-full border-2 border-ink px-4 py-1.5 text-xl font-extrabold" style={{ background: c.color, color: readableOn(c.color) }}>
                  {c.name}
                </span>
              ))
            )}
          </div>
        </div>
      </header>

      <section className="mb-8">
        {waiting.length === 0 ? (
          <div className="card bg-white p-10 text-center">
            <div className="text-6xl">🧮</div>
            <div className="display mt-2 text-4xl">Watching for the next tosser…</div>
          </div>
        ) : (
          <div className="grid gap-5" style={{ gridTemplateColumns: waiting.length === 1 ? "1fr" : "repeat(auto-fit, minmax(360px, 1fr))" }}>
            {waiting.map((w, i) => (
              <WaitingCard key={w.id} entry={w} big={i === 0} />
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="label mb-3 text-2xl">Recent tosses</div>
        {history.length === 0 ? (
          <p className="text-xl text-ink-soft">Nobody yet — the queue starts here.</p>
        ) : (
          <ul className="flex flex-wrap gap-3">
            {history.map((h) => (
              <li key={h.id} className="flex items-center gap-2 rounded-2xl border-2 border-line bg-white px-4 py-2.5 text-xl font-bold">
                {h.className && h.classColor && (
                  <span className="h-3.5 w-3.5 rounded-full border-2 border-ink" style={{ background: h.classColor }} />
                )}
                {h.name}
                <span className="text-ink-soft">×{h.tosses}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function WaitingCard({ entry, big }: { entry: TvWaitingEntry; big: boolean }) {
  const left = Math.max(0, Math.ceil((TOSS_WINDOW_MS - (Date.now() - new Date(entry.wonAt).getTime())) / 1000));
  return (
    <div className={cn("card overflow-hidden border-4 border-ink bg-sun text-center", big ? "p-10" : "p-6")}>
      <div className={cn(big ? "text-7xl" : "text-5xl")}>🏆</div>
      <div className={cn("display mt-2 leading-tight", big ? "text-6xl" : "text-4xl")}>{entry.name}</div>
      {entry.className && (
        <span className="mt-2 inline-block rounded-full border-2 border-ink px-3 py-1 text-lg font-extrabold" style={{ background: entry.classColor ?? "#fff" }}>
          {entry.className}
        </span>
      )}
      <div className={cn("display mt-3 tabular leading-none", big ? "text-8xl" : "text-6xl")}>{left}</div>
      <div className="mt-1 text-lg font-extrabold uppercase tracking-widest">go toss now</div>
    </div>
  );
}
