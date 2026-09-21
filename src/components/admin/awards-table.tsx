"use client";

import { useState } from "react";
import { setCustomAward } from "@/actions/students";
import { useAct } from "@/components/admin/ui";

interface Row { id: number; name: string; className: string | null; auto: string; custom: string }

export function AwardsTable({ rows, canManage }: { rows: Row[]; canManage: boolean }) {
  const { act, pending } = useAct();
  const [q, setQ] = useState("");
  const shown = rows.filter((r) => r.name.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <div>
      <input className="field mb-3" placeholder="Find a student…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Find a student" />
      <ul className="divide-y divide-line">
        {shown.map((r) => (
          <li key={r.id} className="flex flex-col gap-1.5 py-2.5 sm:flex-row sm:items-center sm:gap-3">
            <div className="min-w-0 sm:w-56"><div className="truncate font-extrabold">{r.name}</div><div className="text-xs text-ink-soft">{r.className ? `Class ${r.className} · ` : ""}auto: {r.auto}</div></div>
            <input
              key={r.custom} className="field !min-h-[40px] flex-1 !py-1.5 text-sm" defaultValue={r.custom} placeholder="Custom award (optional)" disabled={!canManage || pending} maxLength={60}
              aria-label={`Custom award for ${r.name}`}
              onBlur={(e) => { const v = e.target.value.trim(); if (v !== r.custom) act(() => setCustomAward({ id: r.id, award: v })); }}
              onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
