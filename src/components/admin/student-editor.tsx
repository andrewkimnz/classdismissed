"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteStudent, regenerateLoginCode, setAttendance, signOutEverywhere, updateStudent } from "@/actions/students";
import { ConfirmButton, Field, Panel, Segmented, useAct } from "@/components/admin/ui";

interface Props {
  student: { id: number; name: string; studentNo: number; classId: number | null; customAward: string; notes: string; attendance: "expected" | "present" | "absent" };
  classes: { id: number; name: string }[];
  canManage: boolean;
}

export function StudentEditor({ student, classes, canManage }: Props) {
  const [f, setF] = useState({ name: student.name, classId: student.classId === null ? "" : String(student.classId), studentNo: String(student.studentNo), customAward: student.customAward, notes: student.notes });
  const { act, pending } = useAct();
  const router = useRouter();
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF((s) => ({ ...s, [k]: e.target.value }));

  return (
    <div className="space-y-4">
      <Panel title="Attendance"><Segmented value={student.attendance} disabled={pending} onChange={(attendance) => act(() => setAttendance({ id: student.id, attendance }))} options={[{ value: "present", label: "✓ Present" }, { value: "expected", label: "Expected" }, { value: "absent", label: "Absent" }]} /></Panel>
      <Panel title="Details">
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); act(() => updateStudent({ id: student.id, name: f.name, classId: f.classId ? Number(f.classId) : null, studentNo: Number(f.studentNo), customAward: f.customAward, notes: f.notes })); }}>
          <Field label="Full name"><input className="field" value={f.name} onChange={set("name")} disabled={!canManage} required /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Class"><select className="field" value={f.classId} onChange={set("classId")} disabled={!canManage}><option value="">Unassigned</option>{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
            <Field label="Student no."><input className="field" inputMode="numeric" value={f.studentNo} onChange={set("studentNo")} disabled={!canManage} /></Field>
          </div>
          <Field label="Special award override" hint="Leave blank for the automatic award on their keepsake."><input className="field" value={f.customAward} onChange={set("customAward")} disabled={!canManage} maxLength={60} placeholder="e.g. Most Likely To Forge A Signature" /></Field>
          <Field label="Organiser notes" hint="Private. Students never see this."><textarea className="field" value={f.notes} onChange={set("notes")} disabled={!canManage} maxLength={500} /></Field>
          {canManage && <button className="btn btn-primary w-full" disabled={pending}>Save changes</button>}
        </form>
      </Panel>
      {canManage && (
        <Panel title="Sign-in & danger zone">
          <div className="grid gap-2 sm:grid-cols-2">
            <ConfirmButton variant="plain" confirmLabel="Issue new code? Old one stops working" disabled={pending} onConfirm={() => act(() => regenerateLoginCode({ id: student.id }))}>New login code</ConfirmButton>
            <ConfirmButton variant="plain" confirmLabel="Sign out all their phones?" disabled={pending} onConfirm={() => act(() => signOutEverywhere({ id: student.id }))}>Sign out of all phones</ConfirmButton>
          </div>
          <div className="mt-3 border-t-2 border-dashed border-line pt-3">
            <ConfirmButton variant="ghost" confirmLabel="Delete student and ALL their records?" disabled={pending} className="w-full !text-pen" onConfirm={() => act(() => deleteStudent({ id: student.id }), { onOk: () => router.push("/admin/students") })}>Delete student…</ConfirmButton>
            <p className="mt-1 text-xs text-ink-soft">Deleting removes their notes, attempts and detentions. To just hide them, mark them Absent.</p>
          </div>
        </Panel>
      )}
    </div>
  );
}
