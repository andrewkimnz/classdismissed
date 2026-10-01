import { StoreDesk } from "@/components/admin/store-desk";
import { PageHeader } from "@/components/admin/ui";
import { requireAdminPage } from "@/lib/auth/admin";
import { getWorld } from "@/lib/data/world";
import { koinBalance } from "@/lib/domain/koins";

export const metadata = { title: "Store" };

export default async function StoreAdminPage() {
  await requireAdminPage("store");
  const w = await getWorld();

  const products = w.koinProducts.map((p) => ({ id: p.id, name: p.name, price: p.price, stock: p.stock }));
  const students = w.students.map((s) => {
    const k = w.classes.find((c) => c.id === s.classId);
    return {
      id: s.id, name: s.name, studentNo: s.studentNo, className: k?.name ?? null, classColor: k?.color ?? null, photoUrl: s.photoUrl,
      balance: koinBalance(w, s.id),
      hint: `${koinBalance(w, s.id)} Koins`,
    };
  });

  return (
    <>
      <PageHeader title="Store" hint="Phase 2 · Kaco Koins storefront" />
      <StoreDesk products={products} students={students} phase={w.event.phase} />
    </>
  );
}
