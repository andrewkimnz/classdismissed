import { ClubsAdmin } from "@/components/admin/clubs-admin";
import { PageHeader } from "@/components/admin/ui";
import { can, requireAdminPage } from "@/lib/auth/admin";
import { getArchivedClubs } from "@/lib/data/admin";
import { getWorld } from "@/lib/data/world";

export const metadata = { title: "Clubs" };

export default async function ClubsPage() {
  const admin = await requireAdminPage("manage");
  const w = await getWorld();
  const archived = await getArchivedClubs();
  return (
    <>
      <PageHeader title="After-school clubs" hint="add, edit, open, close: nothing is hard-coded" />
      <ClubsAdmin
        clubs={w.clubs.map((c) => ({ id: c.id, name: c.name, icon: c.icon, color: c.color, imageUrl: c.imageUrl, description: c.description, instructions: c.instructions, room: c.room, isOpen: c.isOpen, awardsNote: c.awardsNote, completions: w.completions.filter((x) => x.clubId === c.id).length }))}
        archived={archived.map((a) => ({ id: a.id, name: a.name, icon: a.icon }))}
        canManage={can(admin, "manage")}
      />
    </>
  );
}
