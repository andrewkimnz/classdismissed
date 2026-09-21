import Link from "next/link";
import { PageHeader } from "@/components/admin/ui";
import { StudentsList } from "@/components/admin/students-list";
import { btnClass } from "@/components/ui/kit";
import { can, requireAdminPage } from "@/lib/auth/admin";
import { getWorld } from "@/lib/data/world";
import { computeStudentStats } from "@/lib/domain/stats";

export const metadata = { title: "Students" };

export default async function StudentsPage() {
  const admin = await requireAdminPage("manage");
  const w = await getWorld();
  const stats = computeStudentStats(w);
  const rows = w.students.map((s) => {
    const k = w.classes.find((c) => c.id === s.classId);
    const st = stats.get(s.id)!;
    return {
      id: s.id, name: s.name, studentNo: s.studentNo, classId: s.classId, className: k?.name ?? null, classColor: k?.color ?? null, photoUrl: s.photoUrl,
      attendance: s.attendance, detained: w.detentions.some((d) => d.studentId === s.id && d.status === "pending"), detentions: st.detentions,
    };
  });
  const manage = can(admin, "manage");
  return (
    <>
      <PageHeader title="Students" hint={`${w.students.length} enrolled at KAC Academy`} actions={<>
        {manage && <Link href="/admin/students/import" className={btnClass("plain", "sm")}>Import list</Link>}
        <Link href="/admin/students/cards" className={btnClass("sun", "sm")}>🖨 Print login cards</Link>
      </>} />
      <StudentsList rows={rows} classes={w.classes.map((c) => ({ id: c.id, name: c.name }))} canManage={manage} />
    </>
  );
}
