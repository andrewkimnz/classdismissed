import Link from "next/link";
import { notFound } from "next/navigation";
import { GradeAdjust } from "@/components/admin/grade-adjust";
import { PhotoUploader } from "@/components/admin/photo-uploader";
import { PageHeader, Panel } from "@/components/admin/ui";
import { SubjectScores } from "@/components/student/parts";
import { GradeCompare } from "@/components/student/parts";
import { TimetableList } from "@/components/student/timetable";
import { Chip } from "@/components/ui/kit";
import { studentTag } from "@/lib/auth/codes";
import { can, requireAdminPage } from "@/lib/auth/admin";
import { getAllModifications } from "@/lib/data/admin";
import { getWorld } from "@/lib/data/world";
import { computeStandings } from "@/lib/domain/grades";
import { computeClassStats } from "@/lib/domain/stats";
import { noteBalance } from "@/lib/domain/principal";
import { classTimetable } from "@/lib/domain/timetable";

export default async function ClassDetail({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminPage("manage");
  const { id } = await params;
  const w = await getWorld();
  const k = w.classes.find((c) => c.id === Number(id));
  if (!k) notFound();
  const result = computeStandings(w).find((r) => r.klass.id === k.id)!;
  const members = w.students.filter((s) => s.classId === k.id);
  const cs = computeClassStats(w).get(k.id)!;
  const nb = noteBalance(w, k.id);
  const mods = (await getAllModifications()).filter((m) => m.classId === k.id);
  const rows = classTimetable(w, k.id);
  return (
    <>
      <Link href="/admin/classes" className="mb-2 inline-block text-sm font-extrabold text-accent">← All classes</Link>
      <PageHeader title={`Class ${k.name}`} actions={<Chip tone="ink">#{result.rank} of {w.classes.length}</Chip>} />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <Panel title="Result"><GradeCompare result={result} /></Panel>
          <Panel title="Subject scores" right={<Link href="/admin/scoring" className="text-sm font-extrabold text-accent">Enter scores →</Link>}><SubjectScores result={result} /></Panel>
          <GradeAdjust classId={k.id} canManage={can(admin, "manage")} mods={mods.map((m) => ({ id: m.id, delta: m.deltaPercent, reason: m.reason, kind: m.kind, at: m.createdAt.toISOString(), revoked: Boolean(m.revokedAt), by: m.createdByName }))} />
        </div>
        <div className="space-y-4">
          <Panel title="Class stats"><div className="flex flex-wrap gap-2"><Chip tone="soft">📝 {nb.available}/{nb.required} available ({nb.earned} earned, {nb.spent} used)</Chip><Chip tone="soft">🎒 {cs.clubsCompleted} clubs</Chip><Chip tone="soft">🕵️ {cs.attempts} attempts</Chip><Chip tone="soft">🔓 {cs.successes} successes</Chip><Chip tone="soft">🚨 {cs.detentions} detentions</Chip></div></Panel>
          <Panel title={`Members (${members.length})`}>
            <ul className="divide-y divide-line">{members.map((m) => <li key={m.id}><Link href={`/admin/students/${m.id}`} className="flex items-center justify-between py-2 text-sm font-bold"><span>{m.name}</span><span className="font-mono text-xs text-ink-soft">{studentTag(m.studentNo)}</span></Link></li>)}</ul>
          </Panel>
          <Panel title="Team photo"><PhotoUploader kind="class_team" targetId={k.id} name={`Class ${k.name}`} currentUrl={k.teamPhotoUrl} aspect="landscape" label="Shown on every member's keepsake" /></Panel>
          <Panel title="Phase 1 timetable" right={<Link href="/admin/timetable" className="text-sm font-extrabold text-accent">Edit →</Link>}><TimetableList rows={rows} tz={w.event.timezone} /></Panel>
        </div>
      </div>
    </>
  );
}
