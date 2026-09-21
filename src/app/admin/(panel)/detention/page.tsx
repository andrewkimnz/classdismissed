import { DetentionDesk } from "@/components/admin/detention-desk";
import { PageHeader } from "@/components/admin/ui";
import { requireAdminPage } from "@/lib/auth/admin";
import { pickerStudents } from "@/lib/data/picker";
import { getWorld } from "@/lib/data/world";

export const metadata = { title: "Detention" };

export default async function DetentionPage() {
  await requireAdminPage("detention");
  const w = await getWorld();
  const items = [...w.detentions].reverse().map((d) => {
    const s = w.students.find((x) => x.id === d.studentId);
    const k = w.classes.find((c) => c.id === s?.classId);
    return {
      id: d.id, studentId: d.studentId, name: s?.name ?? "Deleted student", photoUrl: s?.photoUrl ?? null, className: k?.name ?? null, classColor: k?.color ?? null,
      reason: d.reason, room: d.room || w.event.detentionRoom, status: d.status, enteredAt: d.enteredAt.toISOString(), releasedAt: d.releasedAt?.toISOString() ?? null, total: 0, attemptId: d.attemptId,
    };
  });
  return (
    <>
      <PageHeader title="Detention" hint={`report to room ${w.event.detentionRoom}`} />
      <DetentionDesk items={items} students={pickerStudents(w)} />
    </>
  );
}
