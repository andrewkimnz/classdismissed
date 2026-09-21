"use client";

import { useState } from "react";
import { assignDetention, cancelDetention, markDetentionServed, markDetentionsServed, reopenDetention } from "@/actions/detention";
import { ConfirmButton, Panel, useAct } from "@/components/admin/ui";
import { StudentPicker, type PickerStudent } from "@/components/admin/student-picker";
import { Avatar } from "@/components/ui/avatar";
import { Chip, ClassBadge } from "@/components/ui/kit";
import { cn } from "@/lib/cn";
import { timeAgo } from "@/lib/domain/time";

interface Item {
  id: number; studentId: number; name: string; photoUrl: string | null; className: string | null; classColor: string | null;
  reason: string; room: string; status: "pending" | "served" | "cancelled"; enteredAt: string; releasedAt: string | null; total: number; attemptId: number | null;
}

const QUICK_REASONS = ["Caught eating chips in History", "Talking during the lecture", "Phone out in class", "Running in the corridor", "Suspicious behaviour near the Principal's Office"];

export function DetentionDesk({ items, students }: { items: Item[]; students: PickerStudent[] }) {
  const { act, pending } = useAct();
  const [who, setWho] = useState<PickerStudent | null>(null);
  const [reason, setReason] = useState("");
  const current = items.filter((i) => i.status === "pending");
  const past = items.filter((i) => i.status !== "pending");
  // A caught team attempt puts the whole class in detention: show those as one group, everyone else on their own.
  const groups: { attemptId: number | null; items: Item[] }[] = [];
  for (const d of current) {
    const g = d.attemptId === null ? undefined : groups.find((x) => x.attemptId === d.attemptId);
    if (g) g.items.push(d);
    else groups.push({ attemptId: d.attemptId, items: [d] });
  }
  const repeat = new Map<number, number>();
  for (const i of items) if (i.status !== "cancelled") repeat.set(i.studentId, (repeat.get(i.studentId) ?? 0) + 1);

  return (
    <div className="space-y-5">
      <Panel title={`Currently in detention (${current.length})`}>
        {current.length === 0 ? <p className="text-sm text-ink-soft">Nobody in detention. A peaceful school.</p> : (
          <ul className="space-y-3">
            {groups.map((g) => g.items.length > 1 && g.attemptId !== null ? (
              <li key={`g${g.attemptId}`} className="rounded-2xl border-2 border-pen bg-pen/5 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  {g.items[0].className && g.items[0].classColor && <ClassBadge name={`Class ${g.items[0].className}`} color={g.items[0].classColor} className="text-base" />}
                  <span className="display text-xl leading-tight">{g.items.length} students · team detention</span>
                  <span className="text-xs font-bold text-ink-soft">Room {g.items[0].room} · since {timeAgo(g.items[0].enteredAt)}</span>
                </div>
                <div className="mt-0.5 text-sm">{g.items[0].reason}</div>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {g.items.map((d) => (
                    <li key={d.id} className="flex items-center gap-1 rounded-full border-2 border-line bg-white py-0.5 pl-1 pr-1 text-sm font-bold">
                      <Avatar student={{ id: d.studentId, name: d.name, photoUrl: d.photoUrl }} className="h-6 w-5 rounded" />
                      {d.name}
                      <button aria-label={`Release ${d.name}`} title="Release just this student" disabled={pending} onClick={() => act(() => markDetentionServed({ id: d.id }))} className="ml-0.5 rounded-full bg-mint px-1.5 text-xs">✔</button>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 grid grid-cols-[1fr_auto] gap-2.5">
                  <button className="btn btn-good btn-lg" disabled={pending} onClick={() => act(() => markDetentionsServed({ ids: g.items.map((d) => d.id) }))}>✔ SERVE ALL ({g.items.length})</button>
                  <ConfirmButton variant="ghost" confirmLabel="Cancel all?" disabled={pending} onConfirm={() => act(async () => { for (const d of g.items) { const r = await cancelDetention({ id: d.id }); if (!r.ok) return r; } return { ok: true as const, message: `Team detention cancelled for ${g.items.length} students.` }; })}>Cancel</ConfirmButton>
                </div>
              </li>
            ) : g.items.map((d) => (
              <li key={d.id} className="rounded-2xl border-2 border-pen bg-pen/5 p-3">
                <div className="flex items-center gap-3">
                  <Avatar student={{ id: d.studentId, name: d.name, photoUrl: d.photoUrl }} className="h-16 w-14 shrink-0 rounded-xl border-2 border-ink" />
                  <div className="min-w-0 flex-1">
                    <div className="display truncate text-2xl leading-tight">{d.name}</div>
                    <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold text-ink-soft">{d.className && d.classColor && <ClassBadge name={d.className} color={d.classColor} />}<span>Room {d.room}</span><span>· since {timeAgo(d.enteredAt)}</span>{(repeat.get(d.studentId) ?? 0) > 1 && <Chip tone="bad">repeat offender ×{repeat.get(d.studentId)}</Chip>}</div>
                    <div className="mt-0.5 text-sm">{d.reason}</div>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-[1fr_auto] gap-2.5">
                  <button className="btn btn-good btn-lg" disabled={pending} onClick={() => act(() => markDetentionServed({ id: d.id }))}>✔ DETENTION SERVED</button>
                  <ConfirmButton variant="ghost" confirmLabel="Cancel it?" disabled={pending} onConfirm={() => act(() => cancelDetention({ id: d.id }))}>Cancel</ConfirmButton>
                </div>
              </li>
            )))}
          </ul>
        )}
      </Panel>

      <Panel title="Send someone to detention">
        {!who ? <StudentPicker students={students} onPick={setWho} /> : (
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-xl border-2 border-ink bg-paper p-2.5"><div className="display text-xl">{who.name}</div><button className="btn btn-ghost btn-sm" onClick={() => setWho(null)}>Change</button></div>
            <input className="field" placeholder="Reason (shown to the student)" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} />
            <div className="flex flex-wrap gap-1.5">{QUICK_REASONS.map((r) => <button key={r} onClick={() => setReason(r)} className="rounded-full border-2 border-line bg-white px-2.5 py-1 text-xs font-bold active:bg-paper-2">{r}</button>)}</div>
            <button className="btn btn-danger w-full" disabled={pending || !reason.trim()} onClick={() => act(() => assignDetention({ studentId: who.id, reason }), { onOk: () => { setWho(null); setReason(""); } })}>🚨 Send to detention</button>
          </div>
        )}
      </Panel>

      <Panel title="History">
        {past.length === 0 ? <p className="text-sm text-ink-soft">Nothing yet.</p> : (
          <ul className="divide-y divide-line">
            {past.map((d) => (
              <li key={d.id} className={cn("flex items-center gap-3 py-2 text-sm", d.status === "cancelled" && "opacity-55")}>
                <div className="min-w-0 flex-1"><b>{d.name}</b> · {d.reason}<div className="flex items-center gap-1.5 text-xs text-ink-soft"><Chip tone={d.status === "served" ? "good" : "soft"}>{d.status}</Chip>{d.releasedAt && timeAgo(d.releasedAt)}</div></div>
                <ConfirmButton size="sm" variant="ghost" confirmLabel="Put back?" disabled={pending} onConfirm={() => act(() => reopenDetention({ id: d.id }))}>Re-open</ConfirmButton>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
