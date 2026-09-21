import { studentTag } from "@/lib/auth/codes";
import { cn, readableOn } from "@/lib/cn";
import { Avatar } from "@/components/ui/avatar";
import { Crest } from "@/components/ui/crest";

export interface IdCardProps {
  student: { id: number; name: string; studentNo: number; photoUrl: string | null; attendance: "expected" | "present" | "absent" };
  klass: { name: string; color: string } | null;
  phaseLabel: string;
  grade: string | null;
  className?: string;
  /** Compact = smaller, for lists and the keepsake header. */
  compact?: boolean;
}

function Barcode({ seed }: { seed: number }) {
  const bars: { x: number; w: number }[] = [];
  let x = 0, s = seed * 9301 + 49297;
  while (x < 118) {
    s = (s * 9301 + 49297) % 233280;
    const w = 1 + Math.floor((s / 233280) * 3);
    bars.push({ x, w });
    x += w + 1 + (s % 2);
  }
  return (
    <svg viewBox="0 0 120 22" className="h-[22px] w-[110px]" aria-hidden>
      {bars.map((b, i) => <rect key={i} x={b.x} y={0} width={b.w} height={22} fill="#1e2a4a" />)}
    </svg>
  );
}

const STATUS = {
  present: { text: "PRESENT", cls: "text-emerald-700" },
  expected: { text: "EXPECTED", cls: "text-amber-600" },
  absent: { text: "ABSENT", cls: "text-pen" },
} as const;

/** The digital student ID. Built to be screenshotted. */
export function IdCard({ student, klass, phaseLabel, grade, className, compact }: IdCardProps) {
  const band = klass?.color ?? "#1F2A5A";
  const ink = readableOn(band);
  const status = STATUS[student.attendance];
  return (
    <div className={cn("relative mx-auto w-full max-w-[400px]", className)}>
      {/* lanyard slot */}
      <div className="absolute left-1/2 top-[-9px] z-10 h-5 w-14 -translate-x-1/2 rounded-full border-2 border-ink bg-paper" />
      <div className="card relative overflow-hidden bg-white">
        <div className="flex items-center gap-2.5 px-4 pb-2.5 pt-5" style={{ background: band, color: ink }}>
          <div className="rounded-lg bg-white/90 p-1"><Crest size={compact ? 26 : 30} /></div>
          <div className="min-w-0 leading-none">
            <div className="display text-[19px] tracking-wide">KAC ACADEMY</div>
            <div className="mt-1 text-[10px] font-extrabold uppercase tracking-[0.22em] opacity-85">Student ID</div>
          </div>
          <div className="ml-auto text-right leading-none">
            <div className="text-[9px] font-extrabold uppercase tracking-widest opacity-80">Class</div>
            <div className="display text-[26px]">{klass?.name ?? "—"}</div>
          </div>
        </div>

        <div className="lined relative grid grid-cols-[104px_1fr] gap-4 px-4 pb-3 pt-4">
          <div className="relative">
            <span className="tape -top-2 left-4 rotate-[-6deg]" />
            <div className="rotate-[-2deg] rounded-md border-[3px] border-white bg-white shadow-[0_3px_10px_rgba(30,42,74,0.3)]">
              <Avatar student={{ id: student.id, name: student.name, photoUrl: student.photoUrl }} className="aspect-[5/6] w-full" />
            </div>
          </div>

          <div className="min-w-0 pt-0.5">
            <div className="label">Student</div>
            <div className="display text-[26px] leading-[1.02] break-words">{student.name}</div>
            <div className="label mt-2">Student No.</div>
            <div className="font-mono text-xl font-extrabold tracking-wider">{studentTag(student.studentNo)}</div>
            <div className="mt-2.5 flex items-center justify-between gap-2">
              <span className={cn("stamp text-[13px]", status.cls)}>{status.text}</span>
              {/* teacher's red-pen grade: only once something has been marked */}
              {grade && <div className="flex h-[56px] w-[56px] shrink-0 rotate-[-9deg] flex-col items-center justify-center rounded-full border-[3px] border-pen bg-white/80 text-pen">
                <span className="hand text-[31px] leading-none">{grade}</span>
                <span className="-mt-0.5 text-[7px] font-black uppercase tracking-widest">grade</span>
              </div>}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 border-t-2 border-dashed border-line bg-white px-4 py-2.5">
          <Barcode seed={student.studentNo} />
          <span className="rounded-full bg-accent px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-white">{phaseLabel}</span>
        </div>
        <div className="shine pointer-events-none absolute inset-0 overflow-hidden" aria-hidden />
      </div>
    </div>
  );
}
