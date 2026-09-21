import { NotesDesk } from "@/components/admin/notes-desk";
import { PageHeader } from "@/components/admin/ui";
import { requireAdminPage } from "@/lib/auth/admin";
import { getRecentAwards } from "@/lib/data/admin";
import { getWorld } from "@/lib/data/world";
import { noteBalance } from "@/lib/domain/principal";

export const metadata = { title: "Teacher’s Notes" };

export default async function NotesPage() {
  await requireAdminPage("notes");
  const w = await getWorld();
  const recent = await getRecentAwards(20);
  return (
    <>
      <PageHeader title="Teacher’s Notes" hint="the team earns it together: club → class → award" />
      <NotesDesk
        classes={w.classes.map((c) => {
          const b = noteBalance(w, c.id);
          return { id: c.id, name: c.name, color: c.color, earned: b.earned, available: b.available, required: b.required, members: w.students.filter((s) => s.classId === c.id).length };
        })}
        clubs={w.clubs.map((c) => ({ id: c.id, name: c.name, icon: c.icon, color: c.color, awardsNote: c.awardsNote, isOpen: c.isOpen }))}
        done={w.completions.map((c) => `${c.classId}:${c.clubId}`)}
        recent={recent.map((r) => ({ id: r.id, classId: r.classId, kind: r.kind, createdAt: r.createdAt.toISOString(), label: r.label, byName: r.byName }))}
      />
    </>
  );
}
