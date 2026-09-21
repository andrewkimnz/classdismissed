import { PageHeader } from "@/components/admin/ui";
import { StaffAdmin } from "@/components/admin/staff-admin";
import { requireAdminPage } from "@/lib/auth/admin";
import { getAdmins } from "@/lib/data/admin";

export const metadata = { title: "Staff accounts" };

export default async function StaffPage() {
  const me = await requireAdminPage("manage");
  const staff = await getAdmins();
  return (
    <>
      <PageHeader title="Staff accounts" hint="who can run the night" />
      <StaffAdmin meId={me.id} staff={staff.map((s) => ({ id: s.id, name: s.name, username: s.username, role: s.role, active: s.active, lastLoginAt: s.lastLoginAt?.toISOString() ?? null }))} />
    </>
  );
}
