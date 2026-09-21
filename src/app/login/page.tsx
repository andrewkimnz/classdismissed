import { redirect } from "next/navigation";
import { LoginForm } from "./login-form";
import { QrLogin } from "./qr-login";
import { Petals } from "@/components/ui/kit";
import { Crest } from "@/components/ui/crest";
import { getStudentId } from "@/lib/auth/student";

export const metadata = { title: "Student sign-in" };

// Everything here depends on the signed-in person and live data: never pre-render at build time (a build must not touch the database).
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  if ((await getStudentId()) !== null) redirect("/");
  const { e } = await searchParams;
  const notice = e === "code" ? "That QR code didn't match a student. Type the code from your card instead." : e === "slow" ? "Slow down a little, then try again." : null;
  return (
    <div data-phase="school_day" className="app-bg relative flex min-h-dvh flex-col overflow-hidden">
      <Petals count={16} />
      <div className="relative mx-auto flex w-full max-w-[420px] flex-1 flex-col justify-center px-5 py-10">
        <div className="mb-6 text-center">
          <div className="anim-pop inline-block"><Crest size={84} /></div>
          <h1 className="display mt-3 text-[44px] leading-none">KAC <span className="text-dragon-outline">ACADEMY</span></h1>
          <p className="label mt-2 tracking-[0.3em]">Student portal</p>
        </div>
        <div className="card lined p-5">
          <h2 className="display text-2xl">Sign into the portal</h2>
          <p className="mb-3 text-sm text-ink-soft">Scan your QR, or type your code.</p>
          {notice && <p className="mb-3 rounded-xl border-2 border-pen bg-pen/10 p-2.5 text-sm font-bold text-pen">{notice}</p>}
          <QrLogin />
          <div className="my-4 flex items-center gap-3 text-xs font-extrabold uppercase tracking-widest text-ink-soft"><span className="h-px flex-1 bg-line" />or type your code<span className="h-px flex-1 bg-line" /></div>
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
