import { ClassBadge, SectionTitle } from "@/components/ui/kit";
import type { MathLeaderboardRow } from "@/lib/data/math";
import { timeAgo } from "@/lib/domain/time";

/** Server-rendered on purpose: it lists other students' names, so it must never pass through a client
 * component's props (nothing here does — only what's interpolated into this JSX reaches the browser). */
export function MathLeaderboard({ rows }: { rows: MathLeaderboardRow[] }) {
  const waiting = rows.filter((r) => r.waiting).sort((a, b) => (a.wonAt?.getTime() ?? 0) - (b.wonAt?.getTime() ?? 0));
  const tossed = rows.filter((r) => !r.waiting).sort((a, b) => (b.lastTossedAt?.getTime() ?? 0) - (a.lastTossedAt?.getTime() ?? 0));
  return (
    <div>
      <SectionTitle hint="who's up next at the Maths table">Toss queue</SectionTitle>
      {waiting.length === 0 ? (
        <p className="card-soft p-3.5 text-sm text-ink-soft">Nobody's mid-toss right now.</p>
      ) : (
        <ol className="space-y-2">
          {waiting.map((r, i) => (
            <li key={r.id} className="card-soft flex items-center gap-3 border-2 border-mint bg-mint/10 p-3">
              <span className="display w-6 shrink-0 text-center text-xl text-ink-soft">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate font-extrabold">{r.studentName}</div>
                {r.className && <ClassBadge name={r.className} color={r.classColor ?? "#999"} />}
              </div>
              <span className="shrink-0 text-xs font-bold text-ink-soft">{r.wonAt ? timeAgo(r.wonAt) : ""}</span>
            </li>
          ))}
        </ol>
      )}
      {tossed.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-extrabold uppercase tracking-widest text-ink-soft">Already tossed ({tossed.length})</summary>
          <ul className="mt-2 space-y-1.5">
            {tossed.map((r) => (
              <li key={r.id} className="flex items-center gap-2 px-1 text-sm text-ink-soft">
                <span className="flex-1 truncate">{r.studentName}{r.className ? ` · ${r.className}` : ""}{r.tosses > 1 ? ` · ${r.tosses}×` : ""}</span>
                <span className="shrink-0 text-xs">{r.lastTossedAt ? timeAgo(r.lastTossedAt) : ""}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
