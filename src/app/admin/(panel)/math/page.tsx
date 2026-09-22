import { MathDesk } from "@/components/admin/math-desk";
import { PageHeader } from "@/components/admin/ui";
import { getMathLeaderboard } from "@/lib/data/math";
import { requireAdminPage } from "@/lib/auth/admin";

export const metadata = { title: "Maths tosses" };

export default async function MathTossesPage() {
  await requireAdminPage("manage");
  const rows = await getMathLeaderboard();
  const items = rows.map((r) => ({
    id: r.id, studentName: r.studentName, className: r.className, classColor: r.classColor,
    waiting: r.waiting, tosses: r.tosses, wonAt: r.wonAt?.toISOString() ?? null, lastTossedAt: r.lastTossedAt?.toISOString() ?? null,
  }));
  return (
    <>
      <PageHeader title="Maths tosses" hint="who's earned a turn at the toss game" />
      <MathDesk items={items} />
    </>
  );
}
