import { CheckinDesk } from "@/components/admin/checkin-desk";
import { PageHeader } from "@/components/admin/ui";
import { requireAdminPage } from "@/lib/auth/admin";
import { getStudentCodes } from "@/lib/data/admin";
import { pickerStudents } from "@/lib/data/picker";
import { getWorld } from "@/lib/data/world";
import { baseUrl } from "@/lib/url";

export const metadata = { title: "Check-in" };

export default async function CheckinPage() {
  await requireAdminPage("manage");
  const w = await getWorld();
  const codes = await getStudentCodes();
  const picker = pickerStudents(w);
  const rows = picker.map((p) => ({ ...p, attendance: w.students.find((s) => s.id === p.id)!.attendance, checkedInAt: w.students.find((s) => s.id === p.id)!.checkedInAt?.toISOString() ?? null, code: codes.get(p.id) ?? "" }));
  return (
    <>
      <PageHeader title="Check-in" hint="photo · present · hand over the card" />
      <CheckinDesk rows={rows} baseUrl={await baseUrl()} />
    </>
  );
}
