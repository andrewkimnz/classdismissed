import { cn, readableOn } from "@/lib/cn";
import { formatTimeRange } from "@/lib/domain/time";
import type { TimetableRow } from "@/lib/domain/timetable";
import { Chip, Meter } from "@/components/ui/kit";

const roomLabel = (room: string) => (room ? `Room ${room}` : "Room TBC");

/** The big "right now" card. Highlighted hard on purpose. */
export function NowCard({ rows, tz, color }: { rows: TimetableRow[]; tz: string; color: string }) {
  const current = rows.find((r) => r.status === "now");
  const first = rows.find((r) => r.status === "upcoming");
  const done = rows.length > 0 && rows.every((r) => r.status === "complete");

  if (done) {
    return (
      <div className="card bg-white p-5 text-center">
        <div className="text-4xl">🎒</div>
        <div className="display mt-1 text-2xl">School day complete</div>
        <p className="mt-1 text-sm text-ink-soft">Head back to the assembly point and wait for the final bell.</p>
      </div>
    );
  }
  if (!current) {
    return (
      <div className="card relative overflow-hidden bg-white p-5">
        <div className="label">First bell</div>
        <div className="display mt-1 text-3xl">{first ? formatTimeRange(first.period.startsAt, first.period.endsAt, tz).split(" – ")[0] : "Soon"}</div>
        {first?.subject && (
          <p className="mt-2 text-[15px]">
            Head to <b>{roomLabel(first.room)}</b> for <b>{first.subject.name}</b> with your class.
          </p>
        )}
      </div>
    );
  }
  const s = current.subject;
  return (
    <div className="card relative overflow-hidden bg-white" style={{ boxShadow: `0 4px 0 var(--ink), 0 0 0 5px color-mix(in srgb, ${color} 35%, transparent)` }}>
      <div className="flex items-center justify-between px-4 py-2 text-white" style={{ background: color, color: readableOn(color) }}>
        <span className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em]">
          <span className="pulse-ring inline-block h-2.5 w-2.5 rounded-full bg-white" /> Right now · Period {current.period.number}
        </span>
        <span className="text-xs font-extrabold">{formatTimeRange(current.period.startsAt, current.period.endsAt, tz)}</span>
      </div>
      <div className="lined p-4">
        <div className="flex items-center gap-3">
          <div className="text-[52px] leading-none">{s?.icon ?? "📚"}</div>
          <div className="display min-w-0 text-[32px] leading-none">{s?.name ?? "Free period"}</div>
        </div>
        <div className="mt-3 inline-flex items-center gap-2 rounded-xl border-2 border-ink bg-sun px-3 py-1.5">
          <span className="text-[10px] font-black uppercase tracking-widest">Go to</span>
          <span className="display text-xl">{roomLabel(current.room)}</span>
        </div>
      </div>
    </div>
  );
}

export function NextClass({ rows, tz }: { rows: TimetableRow[]; tz: string }) {
  const hasCurrent = rows.some((r) => r.status === "now");
  const next = rows.find((r) => r.status === "upcoming");
  // Before the first bell the "now" card already says where to go.
  if (!next || (!hasCurrent && next.period.number === rows[0]?.period.number)) return null;
  return (
    <div className="card-soft flex items-center gap-3 border-2 border-dashed p-3.5">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-3xl">{next.subject?.icon ?? "📚"}</div>
      <div className="min-w-0 flex-1">
        <div className="label text-accent">Your next class</div>
        <div className="display truncate text-xl leading-tight">{next.subject?.name ?? "TBC"}</div>
        <div className="text-[13px] text-ink-soft">{roomLabel(next.room)} · {formatTimeRange(next.period.startsAt, next.period.endsAt, tz).split(" – ")[0]}</div>
      </div>
    </div>
  );
}

const STATUS_CHIP = { now: <Chip tone="accent">Now</Chip>, upcoming: <Chip tone="soft">Upcoming</Chip>, complete: <Chip tone="good">Complete</Chip> } as const;

export function TimetableList({ rows, tz, scores }: { rows: TimetableRow[]; tz: string; scores?: Map<number, { score: number; max: number }> }) {
  return (
    <ol className="space-y-2.5">
      {rows.map((r) => {
        const mark = r.subject ? scores?.get(r.subject.id) : undefined;
        const isNow = r.status === "now";
        return (
          <li
            key={r.period.id}
            className={cn("relative flex items-center gap-3 rounded-2xl border-2 p-3", isNow ? "border-ink bg-accent-soft shadow-[0_4px_0_var(--ink)]" : r.status === "complete" ? "border-line bg-white/70" : "border-line bg-white")}
          >
            <div className="w-[62px] shrink-0 text-center leading-tight">
              <div className="text-[10px] font-black uppercase tracking-widest text-ink-soft">Period {r.period.number}</div>
              <div className="display text-[15px]">{formatTimeRange(r.period.startsAt, r.period.endsAt, tz).split(" – ")[0]}</div>
            </div>
            <div className={cn("text-3xl", r.status === "complete" && "grayscale-[0.4]")}>{r.subject?.icon ?? "·"}</div>
            <div className="min-w-0 flex-1">
              <div className={cn("display truncate text-[19px] leading-tight", r.status === "complete" && "text-ink-soft")}>{r.subject?.name ?? "—"}</div>
              <div className="text-[13px] text-ink-soft">{roomLabel(r.room)}</div>
              {mark && r.status === "complete" && (
                <div className="mt-1 flex items-center gap-2"><Meter value={mark.score} max={mark.max} /><span className="hand text-lg leading-none text-pen">{mark.score}/{mark.max}</span></div>
              )}
            </div>
            {STATUS_CHIP[r.status]}
          </li>
        );
      })}
    </ol>
  );
}
