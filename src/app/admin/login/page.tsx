import { redirect } from "next/navigation";
import { AdminLoginForm } from "./form";
import { Crest } from "@/components/ui/crest";
import { getAdmin, homePath } from "@/lib/auth/admin";

export const metadata = { title: "Staff sign-in" };

// Everything here depends on the signed-in person and live data: never pre-render at build time (a build must not touch the database).
export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  const admin = await getAdmin();
  if (admin) redirect(homePath(admin));
  return (
    <div data-phase="school_day" className="app-bg flex min-h-dvh items-center justify-center px-5">
      <div className="w-full max-w-sm">
        <div className="mb-5 text-center"><Crest size={64} /><h1 className="display mt-2 text-4xl">STAFF ROOM</h1><p className="label tracking-[0.3em]">KAC Academy · execs only</p></div>
        <div className="card p-5"><AdminLoginForm /></div>
      </div>
    </div>
  );
}
