import Link from "next/link";
import { notFound } from "next/navigation";
import { PhotoUploader } from "@/components/admin/photo-uploader";
import { StudentEditor } from "@/components/admin/student-editor";
import { PageHeader, Panel } from "@/components/admin/ui";
import { Chip, ClassBadge } from "@/components/ui/kit";
import { QrCode } from "@/components/ui/qr";
import { can, requireAdminPage } from "@/lib/auth/admin";
import { displayCode, studentTag } from "@/lib/auth/codes";
import { getStudentCodes } from "@/lib/data/admin";
import { getWorld } from "@/lib/data/world";
import { awardFor, computeStudentStats } from "@/lib/domain/stats";
import { formatDelta } from "@/lib/domain/grades";
import { formatDateTime } from "@/lib/domain/time";
import { baseUrl } from "@/lib/url";

export default async function StudentPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminPage("manage");
  const { id } = await params;
  const w = await getWorld();
  const s = w.students.find((x) => x.id === Number(id));
  if (!s) notFound();
  const code = (await getStudentCodes()).get(s.id) ?? "";
  const k = w.classes.find((c) => c.id === s.classId);
  const stats = computeStudentStats(w).get(s.id)!;
  const tz = w.event.timezone;
  const dets = w.detentions.filter((d) => d.studentId === s.id);
  const url = `${await baseUrl()}/l/${code}`;
  return (
    <>
      <Link href="/admin/students" className="mb-2 inline-block text-sm font-extrabold text-accent">← All students</Link>
      <PageHeader title={s.name} hint={`${studentTag(s.studentNo)}${k ? ` · Class ${k.name}` : ""}`} actions={k && <ClassBadge name={k.name} color={k.color} className="text-base" />} />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <Panel title="Photos">
            <div className="space-y-4">
              <PhotoUploader kind="student_id" targetId={s.id} name={s.name} currentUrl={s.photoUrl} label="ID photo" />
              <PhotoUploader kind="final" targetId={s.id} name={s.name} currentUrl={s.finalPhotoUrl} seedId={s.id} label="Final photo (optional, for the keepsake)" />
            </div>
          </Panel>
          <Panel title="Login">
            <div className="flex items-center gap-4">
              <QrCode value={url} className="h-32 w-32 shrink-0 overflow-hidden rounded-xl border-2 border-ink [&>svg]:h-full [&>svg]:w-full" />
              <div><div className="label">Code</div><div className="display text-4xl tracking-widest">{displayCode(code)}</div><p className="text-xs text-ink-soft">Scan to sign in, or type the code at /login.</p></div>
            </div>
          </Panel>
          <Panel title="Record">
            <p className="mb-2 text-xs text-ink-soft">Teacher’s Notes, clubs and Principal’s Office attempts belong to the <b>class</b>{k ? <> (<Link href={`/admin/classes/${k.id}`} className="font-extrabold text-accent">Class {k.name}</Link>)</> : ""}. Their own record is detention.</p>
            <div className="mb-3 flex flex-wrap gap-2"><Chip tone="soft">📝 class earned {stats.notes}</Chip><Chip tone="soft">🎒 {stats.clubsCompleted} clubs</Chip><Chip tone="soft">🕵️ {stats.attempts} attempts</Chip><Chip tone="soft">🔓 {stats.successes} break-ins</Chip><Chip tone="soft">🚨 {stats.detentions} detentions</Chip></div>
            <p className="mb-3 text-sm">Keepsake award: <b>{awardFor(stats, s.customAward).title}</b></p>
            <ul className="space-y-1 text-sm">
              {dets.map((d) => <li key={`d${d.id}`}>🚨 {d.reason} · <b>{d.status}</b> <span className="text-xs text-ink-soft">· {formatDateTime(d.enteredAt, tz)}</span></li>)}
              {dets.length === 0 && <li className="text-ink-soft">No detentions.</li>}
            </ul>
            <p className="mt-3 text-xs text-ink-soft">Award notes in <Link href="/admin/notes" className="font-extrabold text-accent">Teacher’s Notes</Link>, record results in <Link href="/admin/principal" className="font-extrabold text-accent">Principal’s Office</Link>, and manage <Link href="/admin/detention" className="font-extrabold text-accent">Detention</Link>.</p>
          </Panel>
        </div>
        <StudentEditor
          student={{ id: s.id, name: s.name, studentNo: s.studentNo, classId: s.classId, customAward: s.customAward ?? "", notes: s.notes, attendance: s.attendance }}
          classes={w.classes.map((c) => ({ id: c.id, name: c.name }))}
          canManage={can(admin, "manage")}
        />
      </div>
    </>
  );
}
