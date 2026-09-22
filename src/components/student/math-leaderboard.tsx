import { SectionTitle } from "@/components/ui/kit";
import type { MathLeaderboardRow } from "@/lib/data/math";
import { timeAgo } from "@/lib/domain/time";

/**
 * A simple activity feed, not a queue — several people can be mid-toss at once, so there's no "who's
 * next" to show. Server-rendered on purpose: it lists other students' names, so it must never pass
 * through a client component's props (nothing here does — only what's interpolated into this JSX
 * reaches the browser).
 */
export function MathLeaderboard({ rows }: { rows: MathLeaderboardRow[] }) {
  // A row can be `waiting` again on a second toss before this component cares: only ones that have
  // actually completed at least one belong in an activity feed.
  const tossed = rows.filter((r) => r.tosses > 0).sort((a, b) => (b.lastTossedAt?.getTime() ?? 0) - (a.lastTossedAt?.getTime() ?? 0));
  return (
    <div>
      <SectionTitle>Recent tosses</SectionTitle>
      {tossed.length === 0 ? (
        <p className="card-soft p-3.5 text-sm text-ink-soft">Nobody's tossed yet this round.</p>
      ) : (
        <ul className="space-y-1.5">
          {tossed.map((r) => (
            <li key={r.id} className="flex items-center gap-2 px-1 text-sm text-ink-soft">
              <span className="flex-1 truncate">{r.studentName}{r.className ? ` · ${r.className}` : ""}{r.tosses > 1 ? ` · ${r.tosses}×` : ""}</span>
              <span className="shrink-0 text-xs">{r.lastTossedAt ? timeAgo(r.lastTossedAt) : ""}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
