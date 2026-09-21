"use client";

import { useState } from "react";
import { changeMyPassword, createAdmin, setAdminActive, setAdminRole } from "@/actions/settings";
import { Field, Panel, Segmented, Switch, useAct } from "@/components/admin/ui";
import { Chip } from "@/components/ui/kit";
import { timeAgo } from "@/lib/domain/time";

interface Staff { id: number; name: string; email: string; role: "admin" | "teacher"; active: boolean; lastLoginAt: string | null }

export function StaffAdmin({ staff, meId }: { staff: Staff[]; meId: number }) {
  const { act, pending } = useAct();
  const [f, setF] = useState({ name: "", email: "", password: "", role: "teacher" as "admin" | "teacher" });
  const [pw, setPw] = useState({ current: "", next: "" });
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Accounts">
        <p className="mb-3 text-xs text-ink-soft"><b>Admin</b> = everything. <b>Game master</b> = only the “During event” tools: Score entry, Teacher’s Notes, Principal’s Office and Detention. Nothing else in the staff room.</p>
        <ul className="divide-y divide-line">
          {staff.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
              <div className="min-w-0 flex-1"><div className="font-extrabold">{s.name} {s.id === meId && <Chip tone="accent">you</Chip>}</div><div className="truncate text-xs text-ink-soft">{s.email} · {s.lastLoginAt ? `signed in ${timeAgo(s.lastLoginAt)}` : "never signed in"}</div></div>
              <Segmented value={s.role} disabled={pending || s.id === meId} onChange={(role) => act(() => setAdminRole({ id: s.id, role }))} options={[{ value: "admin", label: "Admin" }, { value: "teacher", label: "Game master" }]} />
              <Switch label={`${s.name} active`} checked={s.active} disabled={pending || s.id === meId} onChange={(active) => act(() => setAdminActive({ id: s.id, active }))} />
            </li>
          ))}
        </ul>
      </Panel>
      <div className="space-y-4">
        <Panel title="Add a staff account">
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); act(() => createAdmin(f), { onOk: () => setF({ name: "", email: "", password: "", role: "teacher" }) }); }}>
            <Field label="Name"><input className="field" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required /></Field>
            <Field label="Email"><input className="field" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required autoComplete="off" /></Field>
            <Field label="Temporary password" hint="Tell them to change it."><input className="field" type="text" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required autoComplete="off" /></Field>
            <Segmented value={f.role} onChange={(role) => setF({ ...f, role })} options={[{ value: "teacher", label: "Game master" }, { value: "admin", label: "Admin" }]} />
            <button className="btn btn-primary w-full" disabled={pending}>Create account</button>
          </form>
        </Panel>
        <Panel title="Change my password">
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); act(() => changeMyPassword(pw), { onOk: () => setPw({ current: "", next: "" }) }); }}>
            <Field label="Current password"><input className="field" type="password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} autoComplete="current-password" required /></Field>
            <Field label="New password"><input className="field" type="password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} autoComplete="new-password" required /></Field>
            <button className="btn w-full" disabled={pending}>Change password</button>
          </form>
        </Panel>
      </div>
    </div>
  );
}
