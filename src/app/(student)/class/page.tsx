import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Card, Chip, Empty, SectionTitle } from "@/components/ui/kit";
import { GradeCompare, SubjectScores } from "@/components/student/parts";
import { requireStudent } from "@/lib/auth/student";
import { studentTag } from "@/lib/auth/codes";
import { readableOn } from "@/lib/cn";
import { formatPct, hasGrade } from "@/lib/domain/grades";
import { pendingDetention } from "@/lib/domain/principal";
import { computeClassStats } from "@/lib/domain/stats";
import { buildStudentView } from "@/lib/domain/student-view";

export const metadata = { title: "My class" };

export default async function ClassPage() {
  const { student, world } = await requireStudent();
  const v = buildStudentView(world, student);
  if (!v.klass || !v.result) return <Empty emoji="🎒" title="No class yet">Ask an exec to place you in a class.</Empty>;
  const { klass, result } = v;
  const after = world.event.phase !== "school_day";
  const cs = computeClassStats(world).get(klass.id)!;
  const facts: [string, number, string][] = [
    ["Teacher’s Notes", cs.notes, "📝"], ["Principal’s Office attempts", cs.attempts, "🕵️"], ["Successful break-ins", cs.successes, "🔓"], ["Detentions", cs.detentions, "🚨"],
  ];
  return (
    <div className="space-y-5">
      <div className="card overflow-hidden bg-white">
        <div className="px-4 py-4" style={{ background: klass.color, color: readableOn(klass.color) }}>
          <div className="text-[11px] font-black uppercase tracking-[0.25em] opacity-80">Class</div>
          <div className="flex items-end justify-between">
            <div className="display text-[56px] leading-none">{klass.name}</div>
            <div className="text-right">
              <div className="text-[10px] font-black uppercase tracking-widest opacity-80">Standing</div>
              <div className="display text-3xl leading-none">#{result.rank}<span className="text-lg opacity-80"> / {world.classes.length}</span></div>
            </div>
          </div>
        </div>
        <div className="p-4">{after ? <GradeCompare result={result} /> : (
          <div className="flex items-center justify-between">
            <div><div className="label">Class result so far</div>{hasGrade(result) && <div className="display text-4xl text-pen">{result.currentGrade}</div>}</div>
            <div className="text-right text-sm font-bold text-ink-soft">{result.scoredCount ? <>{result.raw}/{result.max}<br />{formatPct(result.currentPct)}</> : "Nothing marked yet"}</div>
          </div>
        )}</div>
      </div>

      <div>
        <SectionTitle>Subject scores</SectionTitle>
        <Card><SubjectScores result={result} /></Card>
      </div>

      {after && (
        <div>
          <SectionTitle>Class activity</SectionTitle>
          <dl className="grid grid-cols-2 gap-2.5">
            {facts.map(([label, n, emoji]) => (
              <div key={label} className="card-soft p-3"><dt className="label leading-tight">{emoji} {label}</dt><dd className="display text-3xl tabular">{n}</dd></div>
            ))}
          </dl>
        </div>
      )}

      <div>
        <SectionTitle hint={`${v.classmates.length} students`} right={<Link href="/standings" className="text-sm font-extrabold text-accent">Standings →</Link>}>Classmates</SectionTitle>
        <ul className="space-y-2">
          {v.classmates.map((m) => {
            const detained = world.event.phase !== "event_complete" && pendingDetention(world, m.id);
            return (
              <li key={m.id} className="card-soft flex items-center gap-3 p-2.5">
                <Avatar student={m} className="h-14 w-12 shrink-0 rounded-lg border-2 border-ink" />
                <div className="min-w-0 flex-1">
                  <div className="display truncate text-lg leading-tight">{m.name}</div>
                  <div className="font-mono text-xs font-bold text-ink-soft">{studentTag(m.studentNo)}</div>
                </div>
                {m.id === student.id && <Chip tone="accent">You</Chip>}
                {detained && <Chip tone="bad">🚨 Detention</Chip>}
                {m.attendance === "expected" && <Chip tone="soft">Running late</Chip>}
                {m.attendance === "absent" && <Chip tone="soft">Absent</Chip>}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
