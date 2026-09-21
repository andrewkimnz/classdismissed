import { studentTag } from "@/lib/auth/codes";
import { cn } from "@/lib/cn";
import { formatEventDate } from "@/lib/domain/time";
import { awardFor, type StudentStats } from "@/lib/domain/stats";
import { formatDelta, formatPct, type ClassResult } from "@/lib/domain/grades";
import type { EventRow, StudentRow } from "@/lib/types";
import { Avatar } from "@/components/ui/avatar";
import { Crest } from "@/components/ui/crest";
import { Petals } from "@/components/ui/kit";

/** The end-of-event digital keepsake. Designed for an Instagram story screenshot. */
export function Keepsake({
  student, result, stats, event, classPhotoUrl, classRankLabel,
}: {
  student: StudentRow; result: ClassResult | null; stats: StudentStats; event: EventRow; classPhotoUrl: string | null; classRankLabel: string | null;
}) {
  const award = awardFor(stats, student.customAward);
  const photo = student.finalPhotoUrl ?? student.photoUrl;
  const up = (result?.modDelta ?? 0) > 0;
  const down = (result?.modDelta ?? 0) < 0;
  const facts: [string, number, string][] = [
    ["Teacher's Notes", stats.notes, "📝"],
    ["Principal's Office attempts", stats.attempts, "🕵️"],
    ["Successful break-ins", stats.successes, "🔓"],
    ["Detentions", stats.detentions, "🚨"],
  ];
  return (
    <article id="keepsake" className="relative overflow-hidden rounded-[28px] border-[3px] border-ink text-white shadow-[0_6px_0_var(--ink)]" style={{ background: "linear-gradient(170deg,#1f2a5a 0%,#2d3b80 55%,#3c4a8c 100%)" }}>
      <Petals count={12} />
      <div className="relative px-5 pb-6 pt-6">
        <div className="text-center">
          <div className="mx-auto mb-1 inline-block rounded-2xl bg-white/95 p-1.5"><Crest size={40} /></div>
          <div className="text-[11px] font-extrabold uppercase tracking-[0.3em] text-dragon">KAC Academy</div>
          <h1 className="display text-[44px] leading-[0.95] text-sun drop-shadow-[0_3px_0_rgba(0,0,0,0.3)]">CLASS<br />DISMISSED</h1>
          <p className="mt-1.5 text-xs font-bold tracking-wider text-white/70">{formatEventDate(event.eventDate)}</p>
        </div>

        <div className="relative mx-auto mt-5 w-[72%]">
          <span className="tape -top-2.5 left-1/2 -translate-x-1/2 rotate-[3deg]" />
          <div className="rotate-[-2.5deg] rounded-sm bg-white p-2.5 pb-3 text-ink shadow-[0_8px_18px_rgba(0,0,0,0.4)]">
            <Avatar student={{ id: student.id, name: student.name, photoUrl: photo }} className="aspect-[5/6] w-full" />
            <div className="hand mt-1.5 text-center text-[30px] leading-none">{student.name}</div>
            <div className="mt-0.5 text-center text-[10px] font-black uppercase tracking-[0.2em] text-ink-soft">
              {result ? `Class ${result.klass.name}` : "Unassigned"} · {studentTag(student.studentNo)}
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-center">
          <div>
            <div className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-white/70">Original grade</div>
            <div className="display text-[52px] leading-none text-white/90">{result?.originalGrade ?? "—"}</div>
            <div className="text-xs font-bold text-white/60 tabular">{formatPct(result?.originalPct ?? null)}</div>
          </div>
          <div className="text-3xl text-sun">→</div>
          <div>
            <div className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-sun">Final grade</div>
            <div className="relative mx-auto flex h-[84px] w-[84px] rotate-[-8deg] items-center justify-center rounded-full border-4 border-pen bg-white text-pen">
              <span className="hand text-[58px] leading-none">{result?.currentGrade ?? "—"}</span>
            </div>
            <div className="mt-0.5 text-xs font-bold text-white/80 tabular">{formatPct(result?.currentPct ?? null)}</div>
          </div>
        </div>
        {result && result.modDelta !== 0 && (
          <p className={cn("hand mt-1 text-center text-2xl leading-none", up && "text-mint", down && "text-sakura")}>
            {up ? "Grade mysteriously improved " : "Grade took a hit "} {formatDelta(result.modDelta)}
          </p>
        )}
        {classRankLabel && <p className="mt-3 text-center text-xl font-extrabold leading-snug text-white">🏅 {classRankLabel}</p>}

        <dl className="mt-5 grid grid-cols-2 gap-2.5">
          {facts.map(([label, n, emoji]) => (
            <div key={label} className="rounded-2xl border-2 border-white/25 bg-white/10 p-3 backdrop-blur-sm">
              <dt className="text-[10px] font-extrabold uppercase leading-tight tracking-wider text-white/70">{emoji} {label}</dt>
              <dd className="display text-[34px] leading-none tabular">{n}</dd>
            </div>
          ))}
        </dl>

        {classPhotoUrl && (
          <div className="mx-auto mt-6 w-[86%] rotate-[1.5deg] rounded-sm bg-white p-2 pb-2.5 text-ink shadow-[0_8px_18px_rgba(0,0,0,0.4)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={classPhotoUrl} alt={`Class ${result?.klass.name} photo`} className="aspect-[4/3] w-full object-cover" />
            <div className="hand mt-1 text-center text-2xl leading-none">Class {result?.klass.name}</div>
          </div>
        )}

        <div className="mt-6 rounded-2xl border-[3px] border-dashed border-sun bg-sun/10 p-4 text-center">
          <div className="text-[10px] font-extrabold uppercase tracking-[0.25em] text-sun">Special award</div>
          <div className="stamp mt-1 text-[24px] leading-tight text-sun" style={{ mixBlendMode: "normal" }}>&ldquo;{award.title}&rdquo;</div>
          <p className="hand mt-2 text-xl leading-tight text-white/85">{award.blurb}</p>
        </div>
      </div>
    </article>
  );
}
