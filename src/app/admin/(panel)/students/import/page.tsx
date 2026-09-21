import Link from "next/link";
import { ImportForm } from "@/components/admin/import-form";
import { PageHeader } from "@/components/admin/ui";
import { requireAdminPage } from "@/lib/auth/admin";

export const metadata = { title: "Import students" };

export default async function ImportPage() {
  await requireAdminPage("manage");
  return (
    <>
      <Link href="/admin/students" className="mb-2 inline-block text-sm font-extrabold text-accent">← All students</Link>
      <PageHeader title="Import students" hint="paste the sign-up list, done" />
      <ImportForm />
    </>
  );
}
