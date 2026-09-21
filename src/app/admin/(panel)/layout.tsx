import { AdminNav } from "@/components/admin/nav";
import { ToastProvider } from "@/components/admin/ui";
import { can, requireAdminPage } from "@/lib/auth/admin";

export const metadata = { title: { default: "Staff room", template: "%s · Staff room" } };

// Everything here depends on the signed-in person and live data: never pre-render at build time (a build must not touch the database).
export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdminPage();
  return (
    <div data-phase="school_day" className="app-bg min-h-dvh">
      <ToastProvider>
        <AdminNav name={admin.name} role={admin.role} canManage={can(admin, "manage")} />
        <main className="mx-auto max-w-5xl px-4 pb-28 pt-4 md:ml-64 md:max-w-none md:px-8 md:pb-10 md:pt-8">
          <div className="mx-auto max-w-5xl">{children}</div>
        </main>
      </ToastProvider>
    </div>
  );
}
