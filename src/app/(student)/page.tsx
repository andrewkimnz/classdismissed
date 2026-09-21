import Link from "next/link";
import { IdCard } from "@/components/student/id-card";
import { Keepsake } from "@/components/student/keepsake";
import { ClubCard, GradeCompare, NotesProgress } from "@/components/student/parts";
import { NextClass, NowCard, TimetableList } from "@/components/student/timetable";
import { Card, ClassBadge, LinkButton, SectionTitle } from "@/components/ui/kit";
import { requireStudent } from "@/lib/auth/student";
import { formatPct, hasGrade } from "@/lib/domain/grades";
import { phaseLabel } from "@/lib/domain/phases";
import { buildStudentView } from "@/lib/domain/student-view";

export default async function HomePage() {
  const { student, world } = await requireStudent();
  const v = buildStudentView(world, student);
  const { event } = world;
  const first = student.name.split(" ")[0];
  const card = (
    <IdCard student={student} klass={v.klass} phaseLabel={phaseLabel(event.phase)} grade={v.result && hasGrade(v.result) ? v.result.currentGrade : null} />
  );

  if (event.phase === "event_complete") {
    const rank = v.result ? `Class ${v.result.klass.name} finished #${v.result.rank} of ${world.classes.length}` : null;
    return (
      <div className="space-y-4">
        <Keepsake student={student} result={v.result} stats={v.stats} event={event} classPhotoUrl={v.klass?.teamPhotoUrl ?? null} classRankLabel={rank} />
        <div className="grid grid-cols-2 gap-3">
          <LinkButton href="/standings" variant="sun">Final standings</LinkButton>
          <LinkButton href="/class">My class</LinkButton>
        </div>
      </div>
    );
  }

  if (event.phase === "after_school") {
    const openClubs = world.clubs.filter((c) => c.isOpen);
        return (
      <div className="space-y-5">
        <div className="relative overflow-hidden rounded-2xl border-2 border-ink bg-gradient-to-r from-[#ff9e7d] via-[#ee4f86] to-[#8e5cf0] p-3.5 text-white shadow-[0_4px_0_var(--ink)]">
          <div className="flex items-center gap-3">
            <span className="anim-bell text-3xl">🔔</span>
            <div>
              <div className="display text-2xl leading-none">AFTER SCHOOL IS OPEN</div>
              <div className="text-[13px] font-bold text-white/90">Hi {first}! Explore the clubs. Earn Teacher&rsquo;s Notes.</div>
            </div>
          </div>
        </div>
        {card}

        <Card>
          <NotesProgress clubs={v.noteClubs} done={v.doneClubIds} balance={v.notes} className={v.klass?.name} />
        </Card>

        {v.result && (
          <Card>
            <div className="mb-2 flex items-center justify-between">
              <div className="label">Class {v.result.klass.name} report card</div>
              <Link href="/standings" className="text-xs font-extrabold text-accent">Standings →</Link>
            </div>
            <GradeCompare result={v.result} />
          </Card>
        )}

        <div>
          <SectionTitle right={<Link href="/clubs" className="text-sm font-extrabold text-accent">All clubs →</Link>}>After school clubs</SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            {openClubs.slice(0, 4).map((c) => <ClubCard key={c.id} club={c} done={v.doneClubIds.has(c.id)} href={`/clubs/${c.id}`} />)}
          </div>
        </div>
      </div>
    );
  }

  // ── School day ──────────────────────────────────────────────────────────
  const color = v.klass?.color ?? "#3F7CE0";
  return (
    <div className="space-y-5">
      <p className="hand text-[28px] leading-none">Good evening, <span className="text-sakura-deep">{first}</span>!</p>
      {card}
      {v.klass ? (
        <>
          <NowCard rows={v.rows} tz={event.timezone} color={color} />
          <NextClass rows={v.rows} tz={event.timezone} />
          {v.result && (
            <Link href="/class" className="card-soft flex items-center gap-3 p-3.5 active:bg-paper-2">
              <ClassBadge name={v.klass.name} color={color} className="text-base" />
              <div className="min-w-0 flex-1">
                <div className="display text-lg leading-tight">Your class so far</div>
                <div className="text-[13px] text-ink-soft">{v.result.scoredCount} of {v.result.subjectCount} subjects marked{v.result.scoredCount > 0 && <> · {v.result.raw}/{v.result.max} · {formatPct(v.result.currentPct)}</>}</div>
              </div>
              {hasGrade(v.result) && <div className="display text-3xl text-pen">{v.result.currentGrade}</div>}
            </Link>
          )}
          <div>
            <SectionTitle>Today&rsquo;s timetable</SectionTitle>
            <TimetableList rows={v.rows} tz={event.timezone} scores={v.marks} />
          </div>
        </>
      ) : (
        <Card className="text-center"><div className="text-4xl">🎒</div><p className="display text-xl">No class yet</p><p className="text-sm text-ink-soft">Ask an exec at the sign-in desk to place you in a class.</p></Card>
      )}
    </div>
  );
}
