import Link from "next/link";
import { studentLogout } from "@/actions/auth";
import { IdCard } from "@/components/student/id-card";
import { Card } from "@/components/ui/kit";
import { requireStudent } from "@/lib/auth/student";
import { formatDelta, formatPct, hasGrade } from "@/lib/domain/grades";
import { phaseLabel } from "@/lib/domain/phases";
import { buildStudentView } from "@/lib/domain/student-view";

export const metadata = { title: "Profile" };

export default async function ProfilePage() {
  const { student, world } = await requireStudent();
  const v = buildStudentView(world, student);
  const { event } = world;
  const after = event.phase !== "school_day";
  const stats: [string, number, string][] = [
    ["Teacher’s Notes", v.stats.notes, "📝"], ["Clubs done", v.stats.clubsCompleted, "🎒"], ["Attempts", v.stats.attempts, "🕵️"], ["Break-ins", v.stats.successes, "🔓"], ["Detentions", v.stats.detentions, "🚨"],
  ];
  return (
    <div className="space-y-5">
      <IdCard student={student} klass={v.klass} phaseLabel={phaseLabel(event.phase)} grade={v.result && hasGrade(v.result) ? v.result.currentGrade : null} />

      {v.result && hasGrade(v.result) && (
        <Card>
          <div className="label">Report card · Class {v.result.klass.name}</div>
          <div className="mt-1 flex items-center justify-between gap-3">
            <div><div className="text-xs font-bold text-ink-soft">Original</div><div className="display text-2xl">{v.result.originalGrade} <span className="text-base text-ink-soft tabular">{formatPct(v.result.originalPct)}</span></div></div>
            {after && (<><span className="text-2xl text-ink-soft">→</span><div className="text-right"><div className="text-xs font-bold text-ink-soft">Current {v.result.modDelta !== 0 && formatDelta(v.result.modDelta)}</div><div className="display text-2xl text-accent">{v.result.currentGrade} <span className="text-base text-ink-soft tabular">{formatPct(v.result.currentPct)}</span></div></div></>)}
          </div>
        </Card>
      )}

      {after && (
        <dl className="grid grid-cols-3 gap-2.5">
          {stats.map(([label, n, emoji]) => (
            <div key={label} className="card-soft p-2.5 text-center"><dd className="display text-3xl tabular">{n}</dd><dt className="text-[10px] font-extrabold uppercase leading-tight tracking-wider text-ink-soft">{emoji} {label}</dt></div>
          ))}
        </dl>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Link href="/standings" className="btn btn-sun">Standings</Link>
        <form action={studentLogout}><button className="btn btn-ghost w-full">Sign out</button></form>
      </div>
    </div>
  );
}
