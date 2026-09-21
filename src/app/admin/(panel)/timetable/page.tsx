import { PageHeader } from "@/components/admin/ui";
import { TimetableAdmin } from "@/components/admin/timetable-admin";
import { can, requireAdminPage } from "@/lib/auth/admin";
import { getWorld } from "@/lib/data/world";
import { toHHMM } from "@/lib/domain/time";
import { timetableIssues } from "@/lib/domain/timetable";

export const metadata = { title: "Timetable & subjects" };

export default async function TimetablePage() {
  const admin = await requireAdminPage("manage");
  const w = await getWorld();
  const tz = w.event.timezone;
  return (
    <>
      <PageHeader title="Timetable & subjects" hint="rotations, rooms and marks" />
      <TimetableAdmin
        classes={w.classes.map((c) => ({ id: c.id, name: c.name, color: c.color }))}
        subjects={w.subjects}
        periods={w.periods.map((p) => ({ id: p.id, number: p.number, start: toHHMM(p.startsAt, tz), end: toHHMM(p.endsAt, tz) }))}
        rotations={w.rotations.map((r) => ({ periodId: r.periodId, classId: r.classId, subjectId: r.subjectId, room: r.room }))}
        issues={timetableIssues(w)}
        canManage={can(admin, "manage")}
      />
    </>
  );
}
