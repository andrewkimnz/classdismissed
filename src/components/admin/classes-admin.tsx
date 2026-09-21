"use client";

import Link from "next/link";
import { useState } from "react";
import { createClass, deleteClass, updateClass } from "@/actions/classes";
import { ConfirmButton, Field, Modal, useAct } from "@/components/admin/ui";
import { readableOn } from "@/lib/cn";
import { formatPct } from "@/lib/domain/grades";

interface Item { id: number; name: string; color: string; sortOrder: number; members: number; pct: number | null; grade: string; original: string }

const PALETTE = ["#E8628C", "#F59E0B", "#2FA36B", "#2E86DE", "#8E5CF0", "#E5484D", "#14B8C4", "#84CC16", "#FF7A45", "#6B7280"];

export function ClassesAdmin({ items, canManage }: { items: Item[]; canManage: boolean }) {
  const [editing, setEditing] = useState<Item | "new" | null>(null);
  const { act, pending } = useAct();
  const [f, setF] = useState({ name: "", color: "#E8628C", sortOrder: "0" });
  const open = (it: Item | "new") => {
    setF(it === "new" ? { name: "", color: PALETTE[items.length % PALETTE.length], sortOrder: String(items.length) } : { name: it.name, color: it.color, sortOrder: String(it.sortOrder) });
    setEditing(it);
  };
  const save = () => {
    const base = { name: f.name, color: f.color, sortOrder: Number(f.sortOrder) || 0 };
    act(() => (editing === "new" ? createClass(base) : updateClass({ id: (editing as Item).id, ...base })), { onOk: () => setEditing(null) });
  };
  return (
    <>
      {canManage && <div className="mb-3 text-right"><button className="btn btn-primary btn-sm" onClick={() => open("new")}>+ Add class</button></div>}
      <ul className="grid gap-3 sm:grid-cols-2">
        {items.map((c) => (
          <li key={c.id} className="card overflow-hidden bg-white">
            <Link href={`/admin/classes/${c.id}`} className="block">
              <div className="flex items-center justify-between px-4 py-2.5" style={{ background: c.color, color: readableOn(c.color) }}>
                <span className="display text-3xl leading-none">{c.name}</span>
                <span className="text-right"><span className="display block text-2xl leading-none">{c.grade}</span><span className="text-[11px] font-extrabold tabular opacity-90">{formatPct(c.pct)}</span></span>
              </div>
              <div className="p-3 text-sm font-bold">{c.members} student{c.members === 1 ? "" : "s"} · original {c.original}</div>
            </Link>
            {canManage && <div className="border-t-2 border-dashed border-line p-2"><button className="btn btn-ghost btn-sm w-full" onClick={() => open(c)}>Edit name / colour</button></div>}
          </li>
        ))}
      </ul>
      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "Add a class" : "Edit class"}>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); save(); }}>
          <Field label="Class name" hint="Shown everywhere: 1-A, 2-B… or something fun."><input className="field" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} maxLength={20} required autoFocus /></Field>
          <Field label="Class colour">
            <div className="flex flex-wrap items-center gap-2">
              {PALETTE.map((c) => <button key={c} type="button" aria-label={c} onClick={() => setF({ ...f, color: c })} className="h-9 w-9 rounded-full border-2 border-ink" style={{ background: c, outline: f.color === c ? "3px solid var(--ink)" : "none", outlineOffset: 2 }} />)}
              <input type="color" value={f.color} onChange={(e) => setF({ ...f, color: e.target.value })} className="h-9 w-12 rounded-lg border-2 border-ink bg-white" aria-label="Custom colour" />
            </div>
          </Field>
          <Field label="Sort order"><input className="field" inputMode="numeric" value={f.sortOrder} onChange={(e) => setF({ ...f, sortOrder: e.target.value })} /></Field>
          <button className="btn btn-primary w-full" disabled={pending || !f.name.trim()}>Save</button>
          {editing !== "new" && editing && <ConfirmButton variant="ghost" confirmLabel="Delete class? Members become unassigned" className="w-full !text-pen" onConfirm={() => act(() => deleteClass({ id: (editing as Item).id }), { onOk: () => setEditing(null) })}>Delete class…</ConfirmButton>}
        </form>
      </Modal>
    </>
  );
}
