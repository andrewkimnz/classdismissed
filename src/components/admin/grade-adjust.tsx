"use client";

import { useState } from "react";
import { adjustGrade, revokeModification } from "@/actions/principal";
import { ConfirmButton, Field, Panel, useAct } from "@/components/admin/ui";
import { cn } from "@/lib/cn";
import { formatDelta } from "@/lib/domain/grades";
import { timeAgo } from "@/lib/domain/time";

interface Mod { id: number; delta: number; reason: string; kind: string; at: string; revoked: boolean; by: string | null }

export function GradeAdjust({ classId, mods, canManage }: { classId: number; mods: Mod[]; canManage: boolean }) {
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("");
  const { act, pending } = useAct();
  return (
    <Panel title="Grade modifications">
      {mods.length === 0 ? <p className="mb-3 text-sm text-ink-soft">No changes. This class is on its original grade.</p> : (
        <ul className="mb-3 divide-y divide-line">
          {mods.map((m) => (
            <li key={m.id} className={cn("flex items-center gap-3 py-2 text-sm", m.revoked && "opacity-50")}>
              <span className={cn("display w-16 text-xl", m.delta > 0 ? "text-emerald-700" : "text-pen", m.revoked && "line-through")}>{formatDelta(m.delta)}</span>
              <div className="min-w-0 flex-1">{m.reason}<div className="text-xs text-ink-soft">{m.kind === "manual" ? "manual" : "Principal's Office"} · {timeAgo(m.at)}{m.by && ` · ${m.by}`}{m.revoked && " · reversed"}</div></div>
              {!m.revoked && <ConfirmButton size="sm" variant="ghost" confirmLabel="Reverse?" disabled={pending} onConfirm={() => act(() => revokeModification({ modId: m.id }))}>Reverse</ConfirmButton>}
            </li>
          ))}
        </ul>
      )}
      {canManage && (
        <form className="grid grid-cols-[90px_1fr_auto] items-end gap-2 border-t-2 border-dashed border-line pt-3" onSubmit={(e) => { e.preventDefault(); act(() => adjustGrade({ classId, delta: Number(delta), reason }), { onOk: () => { setDelta(""); setReason(""); } }); }}>
          <Field label="± points"><input className="field" inputMode="decimal" value={delta} onChange={(e) => setDelta(e.target.value.replace(/[^0-9.\-+]/g, ""))} placeholder="+2.5" /></Field>
          <Field label="Reason"><input className="field" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. score correction" maxLength={200} /></Field>
          <button className="btn btn-primary" disabled={pending || !delta || !reason.trim() || Number.isNaN(Number(delta))}>Apply</button>
        </form>
      )}
    </Panel>
  );
}
