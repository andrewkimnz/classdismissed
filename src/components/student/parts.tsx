import Link from "next/link";
import { Check, Lock } from "lucide-react";
import { cn, readableOn } from "@/lib/cn";
import { formatDelta, formatPct, hasGrade, type ClassResult } from "@/lib/domain/grades";
import type { NoteBalance } from "@/lib/domain/principal";
import type { ClubRow, LeaderboardMode } from "@/lib/types";
import { Chip, ClassBadge, Meter } from "@/components/ui/kit";

/** ORIGINAL vs CURRENT, the heart of the after-school story. */
export function GradeCompare({ result, showOriginal = true }: { result: ClassResult; showOriginal?: boolean }) {
  if (!hasGrade(result)) return <p className="rounded-2xl border-2 border-dashed border-line bg-white p-3 text-center text-sm font-bold text-ink-soft">No marks yet, so no grade yet.</p>;
  const changed = result.modDelta !== 0;
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className={cn("rounded-2xl border-2 border-line bg-white p-3", !showOriginal && "hidden")}>
        <div className="label">Original result</div>
        <div className="display text-[34px] leading-none">{result.originalGrade}</div>
        <div className="text-sm font-bold text-ink-soft tabular">{formatPct(result.originalPct)}</div>
      </div>
      <div className={cn("rounded-2xl border-2 border-ink bg-accent-soft p-3 shadow-[0_3px_0_var(--ink)]", !showOriginal && "col-span-2")}>
        <div className="label text-accent">Current result</div>
        <div className="flex items-baseline gap-2">
          <div className="display text-[34px] leading-none">{result.currentGrade}</div>
          {changed && (
            <span className={cn("hand text-2xl leading-none", result.modDelta > 0 ? "text-emerald-700" : "text-pen")}>{formatDelta(result.modDelta)}</span>
          )}
        </div>
        <div className="text-sm font-bold text-ink-soft tabular">{formatPct(result.currentPct)}</div>
      </div>
    </div>
  );
}

export function SubjectScores({ result }: { result: ClassResult }) {
  return (
    <ul className="space-y-2.5">
      {result.subjects.map((s) => (
        <li key={s.subject.id} className="flex items-center gap-3">
          <span className="w-8 text-center text-2xl">{s.subject.icon}</span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="display truncate text-[17px]">{s.subject.name}</span>
              <span className="hand text-xl leading-none text-pen tabular">{s.score === null ? "—" : `${s.score}/${s.max}`}</span>
            </div>
            <Meter value={s.score ?? 0} max={s.max} color={s.subject.color} />
          </div>
        </li>
      ))}
      <li className="flex items-center justify-between border-t-2 border-dashed border-line pt-2.5">
        <span className="label">Total</span>
        {hasGrade(result) ? (
          <span className="display text-xl tabular">
            {result.raw}/{result.max} <span className="text-ink-soft">·</span> {formatPct(result.originalPct)} <span className="text-pen">{result.originalGrade}</span>
          </span>
        ) : (
          <span className="text-sm font-bold text-ink-soft">Nothing marked yet</span>
        )}
      </li>
    </ul>
  );
}

/**
 * The class's Teacher's Notes: "available / required" (attempts spend notes, so this drops
 * after a Principal's Office attempt), plus which clubs the class has completed.
 */
export function NotesProgress({ clubs, done, balance, className }: { clubs: ClubRow[]; done: Set<number>; balance: NoteBalance; className?: string }) {
  const { available, required } = balance;
  const pct = required > 0 ? Math.min(100, (available / required) * 100) : 100;
  return (
    <div>
      <div className="label">{className ? `Class ${className} · ` : ""}Teacher&rsquo;s Notes</div>
      <div className="mb-2 flex items-end justify-end">
        <span className="display text-[34px] leading-none tabular">
          {available}
          {required > 0 && <span className="text-ink-soft"> / {required}</span>}
        </span>
      </div>
      <div className="mb-3 h-3 overflow-hidden rounded-full bg-paper-2 ring-1 ring-line"><div className="h-full rounded-full bg-sakura-deep" style={{ width: `${pct}%` }} /></div>
      <ul className="grid grid-cols-1 gap-1.5">
        {clubs.map((c) => (
          <li key={c.id} className="flex items-center gap-2.5">
            <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2", done.has(c.id) ? "border-ink bg-mint" : "border-line bg-white")}>
              {done.has(c.id) && <Check size={16} strokeWidth={3.5} />}
            </span>
            <span className={cn("text-[15px] font-bold", !done.has(c.id) && "text-ink-soft")}>{c.icon} {c.name}</span>
            {!c.isOpen && <Chip tone="soft" className="ml-auto">Closed</Chip>}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ClubCard({ club, done, href }: { club: ClubRow; done: boolean; href: string }) {
  return (
    <Link href={href} className="card group relative block overflow-hidden bg-white transition-transform active:translate-y-[3px] active:shadow-[0_1px_0_var(--ink)]">
      <div className="flex h-[76px] items-center justify-center text-[42px]" style={{ background: club.color, color: readableOn(club.color) }}>
        {club.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={club.imageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span>{club.icon}</span>
        )}
      </div>
      <div className="p-3">
        <div className="display text-[17px] leading-tight">{club.name}</div>
        <div className="mt-0.5 text-[13px] font-semibold text-ink-soft">{club.room ? `Room ${club.room}` : "Room TBC"}</div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {club.isOpen ? <Chip tone="good">Open</Chip> : <Chip tone="soft">Closed</Chip>}
          {club.awardsNote && <span title="Earns a Teacher's Note" className="text-base">📝</span>}
        </div>
      </div>
      {done && <span className="stamp absolute right-2 top-1 bg-white/85 text-[11px] text-emerald-700">Done ✓</span>}
    </Link>
  );
}

export function Leaderboard({
  rows, mode, myClassId,
}: { rows: ClassResult[]; mode: LeaderboardMode; myClassId?: number | null }) {
  if (mode === "hidden") {
    return (
      <div className="card bg-white p-6 text-center">
        <div className="text-5xl">🙈</div>
        <div className="display mt-2 text-2xl">Standings are hidden</div>
        <p className="mt-1 text-sm text-ink-soft">The staff room is keeping the suspense alive. Check back at the final assembly.</p>
      </div>
    );
  }
  return (
    <ol className="space-y-2">
      {rows.map((r) => {
        const mine = r.klass.id === myClassId;
        const ranked = hasGrade(r); // no medal (or number) for a class nothing has been marked for yet
        const medal = !ranked ? null : r.rank === 1 ? "🥇" : r.rank === 2 ? "🥈" : r.rank === 3 ? "🥉" : null;
        return (
          <li key={r.klass.id} className={cn("flex items-center gap-3 rounded-2xl border-2 p-2.5 pr-3.5", mine ? "border-ink bg-accent-soft shadow-[0_3px_0_var(--ink)]" : "border-line bg-white")}>
            <div className="w-9 text-center">{medal ? <span className="text-2xl">{medal}</span> : <span className="display text-xl text-ink-soft">{ranked ? r.rank : "–"}</span>}</div>
            <span className="h-9 w-1.5 rounded-full" style={{ background: r.klass.color }} />
            <div className="min-w-0 flex-1">
              <div className="display flex items-center gap-2 text-xl leading-tight">Class {r.klass.name}{mine && <Chip tone="accent">You</Chip>}</div>
            </div>
            <div className="text-right leading-tight">
              {hasGrade(r) ? (
                <>
                  {mode === "exact" && <div className="text-sm font-extrabold tabular text-ink-soft">{formatPct(r.currentPct)}</div>}
                  <div className="display text-2xl">{r.currentGrade}</div>
                </>
              ) : (
                <div className="text-xs font-extrabold uppercase tracking-wider text-ink-soft">Not marked</div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function LockedScreen({ emoji = "🔒", title, children }: { emoji?: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="card lined mt-4 p-7 text-center">
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border-2 border-ink bg-sun text-5xl">{emoji}</div>
      <h1 className="display mt-3 text-3xl leading-tight">{title}</h1>
      {children && <div className="mx-auto mt-2 max-w-[280px] text-[15px] text-ink-soft">{children}</div>}
      <div className="mt-3 inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-widest text-ink-soft"><Lock size={14} /> Locked for now</div>
    </div>
  );
}

export { ClassBadge };
