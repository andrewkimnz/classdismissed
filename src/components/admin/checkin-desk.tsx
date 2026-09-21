"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { setAttendance } from "@/actions/students";
import { ClientQr } from "@/components/admin/client-qr";
import { PhotoUploader } from "@/components/admin/photo-uploader";
import { Panel, Segmented, useAct } from "@/components/admin/ui";
import { StudentPicker, type PickerStudent } from "@/components/admin/student-picker";
import { ClassBadge } from "@/components/ui/kit";
import { displayCode, studentTag } from "@/lib/auth/codes";

interface Row extends PickerStudent { attendance: "expected" | "present" | "absent"; code: string; photoUrl: string | null; checkedInAt: string | null }

type Tone = "waiting" | "arrived" | "absent";

/** Sign-in desk: find student → photo → mark present → hand over the login card. */
export function CheckinDesk({ rows, baseUrl }: { rows: Row[]; baseUrl: string }) {
  const [id, setId] = useState<number | null>(null);
  const { act, pending } = useAct();
  const s = rows.find((r) => r.id === id) ?? null; // read fresh from props so it updates after each save
  const byName = (a: Row, b: Row) => a.name.localeCompare(b.name);
  const missing = rows.filter((r) => r.attendance === "expected").sort(byName);
  const arrived = rows.filter((r) => r.attendance === "present").sort((a, b) => (b.checkedInAt ?? "").localeCompare(a.checkedInAt ?? "")); // latest first
  const absent = rows.filter((r) => r.attendance === "absent").sort(byName);
  const panel = useRef<HTMLDivElement>(null);
  // Picking someone from a long list further down the page should bring their card into view.
  useEffect(() => {
    if (id !== null) panel.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [id]);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="card-soft p-3"><div className="display text-3xl">{arrived.length}</div><div className="label">Checked in</div></div>
        <div className="card-soft p-3"><div className="display text-3xl">{missing.length}</div><div className="label">Expected</div></div>
        <div className="card-soft p-3"><div className="display text-3xl">{absent.length}</div><div className="label">Absent</div></div>
      </div>

      <Panel title="Find a student">
        <StudentPicker students={rows} onPick={(p) => setId(p.id)} autoFocus placeholder="Type a name or number…" />
      </Panel>

      {s && (
        <div ref={panel} className="scroll-mt-16">
        <Panel className="border-ink shadow-[0_4px_0_var(--ink)]">
          <div className="mb-3 flex items-start justify-between gap-2">
            <div><div className="display text-3xl leading-tight">{s.name}</div><div className="flex items-center gap-2 text-sm font-bold text-ink-soft"><span className="font-mono">{studentTag(s.studentNo)}</span>{s.className && s.classColor && <ClassBadge name={`Class ${s.className}`} color={s.classColor} />}</div></div>
            <button className="btn btn-ghost btn-sm" onClick={() => setId(null)}>Done</button>
          </div>
          <div className="mb-4"><Segmented value={s.attendance} disabled={pending} onChange={(attendance) => act(() => setAttendance({ id: s.id, attendance }))} options={[{ value: "present", label: "✓ Present" }, { value: "expected", label: "Expected" }, { value: "absent", label: "Absent" }]} /></div>
          <PhotoUploader kind="student_id" targetId={s.id} name={s.name} currentUrl={s.photoUrl} label="ID photo (make it awkward)" />
          <div className="mt-4 flex items-center gap-4 rounded-2xl border-2 border-dashed border-line bg-white p-3">
            <ClientQr value={`${baseUrl}/l/${s.code}`} size={112} className="shrink-0 rounded-lg border-2 border-ink" />
            <div>
              <div className="label">Login code</div>
              <div className="display text-4xl tracking-widest">{displayCode(s.code)}</div>
              <p className="text-xs text-ink-soft">They scan the QR (or type the code) to open their KAC Academy ID.</p>
              <Link href={`/admin/students/${s.id}`} className="text-xs font-extrabold text-accent">Full profile →</Link>
            </div>
          </div>
        </Panel>
        </div>
      )}

      <Panel title={`Still to arrive (${missing.length})`}>
        <NameList people={missing} tone="waiting" empty="Everyone on the list has arrived or been marked absent." onPick={setId} />
      </Panel>

      <Panel title={`Arrived (${arrived.length})`}>
        <NameList people={arrived} tone="arrived" empty="Nobody has checked in yet." onPick={setId} />
      </Panel>

      <Panel title={`Absent (${absent.length})`}>
        <NameList people={absent} tone="absent" empty="Nobody is marked absent." onPick={setId} />
      </Panel>
    </div>
  );
}

const CHIP: Record<Tone, string> = {
  waiting: "border-line bg-white active:bg-paper-2",
  arrived: "border-ink/30 bg-mint/40 active:bg-mint",
  absent: "border-line bg-paper-2 text-ink-soft active:bg-line",
};

/** Tap a name to open that student's check-in card above. */
function NameList({ people, tone, empty, onPick }: { people: Row[]; tone: Tone; empty: string; onPick: (id: number) => void }) {
  if (people.length === 0) return <p className="text-sm text-ink-soft">{empty}</p>;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {people.map((m) => (
        <li key={m.id}>
          <button onClick={() => onPick(m.id)} className={`rounded-full border-2 px-2.5 py-1 text-sm font-bold ${CHIP[tone]}`}>
            {tone === "arrived" && <span className="mr-1">✓</span>}
            {m.name}
            {m.className && <span className="ml-1 text-xs font-semibold text-ink-soft">{m.className}</span>}
          </button>
        </li>
      ))}
    </ul>
  );
}
