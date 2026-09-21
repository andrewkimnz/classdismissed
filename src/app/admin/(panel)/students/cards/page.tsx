import Link from "next/link";
import { PrintButton } from "@/components/admin/print-button";
import { Crest } from "@/components/ui/crest";
import { QrCode } from "@/components/ui/qr";
import { readableOn } from "@/lib/cn";
import { requireAdminPage } from "@/lib/auth/admin";
import { displayCode, studentTag } from "@/lib/auth/codes";
import { getStudentCodes } from "@/lib/data/admin";
import { getWorld } from "@/lib/data/world";
import { baseUrl } from "@/lib/url";

export const metadata = { title: "Login cards" };

/** Print-ready sign-in cards: name, class, number and a QR that logs the student straight in. */
export default async function CardsPage({ searchParams }: { searchParams: Promise<{ class?: string }> }) {
  await requireAdminPage("manage");
  const { class: classFilter } = await searchParams;
  const w = await getWorld();
  const codes = await getStudentCodes();
  const base = await baseUrl();
  const students = w.students.filter((s) => !classFilter || String(s.classId) === classFilter);
  return (
    <>
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
        <div><Link href="/admin/students" className="text-sm font-extrabold text-accent">← Students</Link><h1 className="display text-3xl">Login cards</h1><p className="text-sm text-ink-soft">{students.length} cards · print on A4, cut along the dashed lines. Anyone holding a card can sign in as that student, so hand them out at check-in.</p></div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1.5">
            <Link href="/admin/students/cards" className={`rounded-full border-2 border-ink px-3 py-1 text-sm font-extrabold ${!classFilter ? "bg-ink text-white" : "bg-white"}`}>All</Link>
            {w.classes.map((c) => <Link key={c.id} href={`/admin/students/cards?class=${c.id}`} className={`rounded-full border-2 border-ink px-3 py-1 text-sm font-extrabold ${classFilter === String(c.id) ? "bg-ink text-white" : "bg-white"}`}>{c.name}</Link>)}
          </div>
          <PrintButton />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 print:grid-cols-2 lg:grid-cols-3">
        {await Promise.all(students.map(async (s) => {
          const k = w.classes.find((c) => c.id === s.classId);
          const code = codes.get(s.id) ?? "";
          return (
            <div key={s.id} className="print-page flex items-center gap-3 rounded-xl border-2 border-dashed border-ink bg-white p-3">
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center gap-1.5"><Crest size={20} /><span className="display text-sm leading-none">KAC ACADEMY</span></div>
                <div className="display break-words text-xl leading-tight">{s.name}</div>
                <div className="font-mono text-sm font-extrabold">{studentTag(s.studentNo)}</div>
                {k && <span className="mt-1 inline-block rounded px-1.5 py-0.5 text-xs font-extrabold" style={{ background: k.color, color: readableOn(k.color) }}>Class {k.name}</span>}
                <div className="mt-1.5 text-[10px] font-bold uppercase tracking-wider text-ink-soft">Sign-in code</div>
                <div className="display text-2xl tracking-widest">{displayCode(code)}</div>
              </div>
              <QrCode value={`${base}/l/${code}`} className="h-24 w-24 shrink-0 [&>svg]:h-full [&>svg]:w-full" />
            </div>
          );
        }))}
      </div>
    </>
  );
}
