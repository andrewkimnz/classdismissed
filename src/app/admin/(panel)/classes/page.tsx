import { ClassesAdmin } from "@/components/admin/classes-admin";
import { PageHeader } from "@/components/admin/ui";
import { can, requireAdminPage } from "@/lib/auth/admin";
import { getWorld } from "@/lib/data/world";
import { computeStandings } from "@/lib/domain/grades";

export const metadata = { title: "Classes" };

export default async function ClassesPage() {
  const admin = await requireAdminPage("manage");
  const w = await getWorld();
  const res = computeStandings(w);
  const items = w.classes.map((c) => {
    const r = res.find((x) => x.klass.id === c.id)!;
    return { id: c.id, name: c.name, color: c.color, sortOrder: c.sortOrder, members: w.students.filter((s) => s.classId === c.id).length, pct: r.currentPct, grade: r.currentGrade, original: r.originalGrade };
  });
  return (
    <>
      <PageHeader title="Classes" hint="the eight teams" />
      <ClassesAdmin items={items} canManage={can(admin, "manage")} />
    </>
  );
}
