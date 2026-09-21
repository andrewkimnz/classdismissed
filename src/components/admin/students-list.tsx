"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { autoAssignUnassigned, createStudent } from "@/actions/students";
import { Field, Modal, useAct } from "@/components/admin/ui";
import { Avatar } from "@/components/ui/avatar";
import { Chip, ClassBadge } from "@/components/ui/kit";
import { studentTag } from "@/lib/auth/codes";

interface Row {
  id: number; name: string; studentNo: number; classId: number | null; className: string | null; classColor: string | null;
  photoUrl: string | null; attendance: "expected" | "present" | "absent"; detained: boolean; detentions: number;
}

export function StudentsList({ rows, classes, canManage }: { rows: Row[]; classes: { id: number; name: string }[]; canManage: boolean }) {
  const [q, setQ] = useState("");
  const [cls, setCls] = useState<string>("all");
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [classId, setClassId] = useState<string>("");
  const { act, pending } = useAct();
  const router = useRouter();

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return rows.filter((r) => (cls === "all" || (cls === "none" ? r.classId === null : String(r.classId) === cls)) && (!t || r.name.toLowerCase().includes(t) || String(r.studentNo).includes(t.replace(/^kac-?/, ""))));
  }, [rows, q, cls]);
  const unassigned = rows.filter((r) => r.classId === null).length;

  return (
    <div>
      <div className="mb-3 flex flex-col gap-2 sm:flex-row">
        <input className="field flex-1" placeholder="Search name or number…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search students" />
        <select className="field sm:w-48" value={cls} onChange={(e) => setCls(e.target.value)} aria-label="Filter by class">
          <option value="all">All classes</option>
          {classes.map((c) => <option key={c.id} value={c.id}>Class {c.name}</option>)}
          <option value="none">Unassigned ({unassigned})</option>
        </select>
        {canManage && <button className="btn btn-primary" onClick={() => setAdding(true)}>+ Add student</button>}
      </div>
      {canManage && unassigned > 0 && (
        <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border-2 border-dashed border-pen bg-pen/5 p-3 text-sm font-bold">
          <span>{unassigned} student{unassigned === 1 ? " has" : "s have"} no class yet.</span>
          <button className="btn btn-sm" disabled={pending} onClick={() => act(() => autoAssignUnassigned())}>Auto-balance them</button>
        </div>
      )}
      <p className="mb-2 text-xs font-bold text-ink-soft">{shown.length} of {rows.length} students</p>
      <ul className="space-y-2">
        {shown.map((r) => (
          <li key={r.id}>
            <Link href={`/admin/students/${r.id}`} className="flex items-center gap-3 rounded-2xl border-2 border-line bg-white p-2 active:bg-paper-2">
              <Avatar student={{ id: r.id, name: r.name, photoUrl: r.photoUrl }} className="h-14 w-12 shrink-0 rounded-lg border-2 border-ink" />
              <div className="min-w-0 flex-1">
                <div className="display truncate text-xl leading-tight">{r.name}</div>
                <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold text-ink-soft"><span className="font-mono">{studentTag(r.studentNo)}</span>{r.className && r.classColor ? <ClassBadge name={r.className} color={r.classColor} /> : <Chip tone="warn">no class</Chip>}{r.detentions > 0 && <span>🚨 {r.detentions}</span>}</div>
              </div>
              {r.detained ? <Chip tone="bad">Detention</Chip> : r.attendance === "present" ? <Chip tone="good">Present</Chip> : r.attendance === "absent" ? <Chip tone="soft">Absent</Chip> : <Chip tone="warn">Expected</Chip>}
            </Link>
          </li>
        ))}
        {shown.length === 0 && <li className="rounded-xl border-2 border-dashed border-line p-6 text-center text-sm text-ink-soft">No students match.</li>}
      </ul>

      <Modal open={adding} onClose={() => setAdding(false)} title="Add a student">
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); act(() => createStudent({ name, classId: classId ? Number(classId) : null }), { onOk: (r) => { setAdding(false); setName(""); if (r.data) router.push(`/admin/students/${r.data.id}`); } }); }}>
          <Field label="Full name"><input className="field" value={name} onChange={(e) => setName(e.target.value)} required autoFocus /></Field>
          <Field label="Class" hint="Leave blank to place them later (or auto-balance)."><select className="field" value={classId} onChange={(e) => setClassId(e.target.value)}><option value="">Unassigned</option>{classes.map((c) => <option key={c.id} value={c.id}>Class {c.name}</option>)}</select></Field>
          <p className="text-xs text-ink-soft">Student number and login code are generated automatically.</p>
          <button className="btn btn-primary w-full" disabled={pending || !name.trim()}>Add student</button>
        </form>
      </Modal>
    </div>
  );
}
