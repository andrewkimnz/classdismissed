"use client";

import { useState } from "react";
import { recordAttempt, revokeModification, voidAttempt } from "@/actions/principal";
import { ConfirmButton, Panel, useAct } from "@/components/admin/ui";
import { Chip } from "@/components/ui/kit";
import { cn, readableOn } from "@/lib/cn";
import { formatDelta } from "@/lib/domain/grades";
import { timeAgo } from "@/lib/domain/time";

type Tier = { id: number; name: string; icon: string; successDelta: number; failureDelta: number; failureDetention: boolean; enabled: boolean };
interface ClassItem { id: number; name: string; color: string; members: number; earned: number; spent: number; available: number; required: number; why: string | null }
interface HistoryItem {
  id: number; classId: number; className: string; classColor: string; status: string; outcome: "success" | "failure" | null; tierName: string; tierIcon: string;
  delta: number | null; detentions: number; notes: string; at: string;
}
interface ModItem { id: number; className: string; delta: number; reason: string; at: string; revoked: boolean }

interface Props { tiers: Tier[]; classes: ClassItem[]; history: HistoryItem[]; mods: ModItem[]; room: string }

const preview = (t: Tier | undefined, outcome: "success" | "failure") =>
  !t ? "" : outcome === "success" ? formatDelta(t.successDelta) : `${t.failureDelta === 0 ? "±0%" : formatDelta(t.failureDelta)}${t.failureDetention ? " + class detention" : ""}`;

function OutcomeButtons({ tier, disabled, onPick }: { tier?: Tier; disabled?: boolean; onPick: (o: "success" | "failure") => void }) {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      <button className="btn btn-good btn-lg flex-col !gap-0 !py-2" disabled={disabled} onClick={() => onPick("success")}>✅ SUCCESS<span className="text-sm font-bold">{preview(tier, "success")}</span></button>
      <button className="btn btn-danger btn-lg flex-col !gap-0 !py-2" disabled={disabled} onClick={() => onPick("failure")}>🚨 CAUGHT<span className="text-sm font-bold">{preview(tier, "failure")}</span></button>
    </div>
  );
}

/** The team goes into the Principal's Office together: record it for the CLASS. Each attempt spends notes. */
export function PrincipalDesk({ tiers, classes, history, mods, room }: Props) {
  const { act, pending } = useAct();
  const enabled = tiers.filter((t) => t.enabled);
  const [classId, setClassId] = useState<number | null>(null);
  const [tierId, setTierId] = useState<number | null>(null); // what the team chose to risk: the exec picks it deliberately
  const [force, setForce] = useState(false);
  const klass = classes.find((c) => c.id === classId) ?? null;
  const tier = tiers.find((t) => t.id === tierId);

  return (
    <div className="space-y-5">
      <Panel title="Record an attempt" right={<Chip tone="soft">Room {room}</Chip>}>
        <div className="label mb-1.5">Which class went in?</div>
        <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {classes.map((c) => (
            <li key={c.id}>
              <button
                aria-pressed={classId === c.id} onClick={() => { setClassId(c.id); setForce(false); }}
                className={cn("w-full rounded-2xl border-2 p-2.5 text-left active:scale-[0.98]", classId === c.id ? "border-ink bg-sun shadow-[0_3px_0_var(--ink)]" : c.why ? "border-line bg-paper-2" : "border-line bg-white")}
              >
                <span className="display inline-block rounded-lg px-2.5 py-0.5 text-2xl leading-tight" style={{ background: c.color, color: readableOn(c.color) }}>{c.name}</span>
                <span className="mt-1 block text-xs font-bold text-ink-soft">📝 {c.available} left{c.required > 0 ? ` · needs ${c.required}` : ""}</span>
                <span className={cn("block text-[10px] font-extrabold uppercase tracking-wider", c.why ? "text-pen" : "text-emerald-700")}>{c.why ? "not enough notes" : "can go in"}</span>
              </button>
            </li>
          ))}
        </ul>

        {klass && (
          <div className="mt-4 space-y-3 rounded-2xl border-2 border-ink bg-paper p-3">
            <div className="flex items-center justify-between gap-2">
              <div><div className="display text-2xl leading-tight">Class {klass.name}</div><div className="text-xs font-bold text-ink-soft">{klass.members} students · {klass.earned} notes earned · {klass.spent} used · {klass.available} left</div></div>
              <button className="btn btn-ghost btn-sm" onClick={() => { setClassId(null); setForce(false); }}>Change</button>
            </div>
            {klass.why && (
              <label className="flex items-start gap-2 rounded-xl border-2 border-dashed border-pen bg-pen/5 p-2.5 text-sm font-bold text-pen"><input type="checkbox" className="mt-1 h-4 w-4" checked={force} onChange={(e) => setForce(e.target.checked)} /><span>{klass.why} <span className="block font-semibold text-ink-soft">Tick to record it anyway (logged in the activity trail). It will use up only the {klass.available} note{klass.available === 1 ? "" : "s"} they have, so they never go negative.</span></span></label>
            )}
            <div className="label">What did the team choose to risk?</div>
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Risk level">
              {enabled.map((t) => <button key={t.id} role="radio" aria-checked={tierId === t.id} onClick={() => setTierId(t.id)} className={cn("rounded-full border-2 border-ink px-3 py-1 text-sm font-extrabold", tierId === t.id ? "bg-ink text-white" : "bg-white")}>{t.icon} {t.name}</button>)}
            </div>
            <OutcomeButtons tier={tier} disabled={pending || tierId === null || (Boolean(klass.why) && !force)} onPick={(outcome) => act(() => recordAttempt({ classId: klass.id, outcome, tierId: tierId ?? undefined, force }), { onOk: () => { setClassId(null); setTierId(null); setForce(false); } })} />
            <p className="text-xs text-ink-soft">The result applies to the whole class. Recording it spends {Math.min(klass.required, klass.available)} Teacher’s Note{Math.min(klass.required, klass.available) === 1 ? "" : "s"}.</p>
          </div>
        )}
      </Panel>

      <Panel title="Attempt history">
        {history.length === 0 ? <p className="text-sm text-ink-soft">No attempts yet.</p> : (
          <ul className="divide-y divide-line">
            {history.map((h) => (
              <li key={h.id} className={cn("flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2.5", (h.status === "voided" || h.status === "cancelled") && "opacity-55")}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-sm"><span className="display rounded-md px-1.5 text-base" style={{ background: h.classColor, color: readableOn(h.classColor) }}>{h.className}</span> {h.tierIcon} {h.tierName}</div>
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-ink-soft">
                    {h.status === "resolved" ? <Chip tone={h.outcome === "success" ? "good" : "bad"}>{h.outcome === "success" ? "success" : "caught"} {h.delta ? formatDelta(h.delta) : "±0%"}{h.detentions ? ` + ${h.detentions} detentions` : ""}</Chip> : <Chip tone="soft">{h.status}{h.status === "voided" ? " · notes refunded" : ""}</Chip>}
                    <span>{timeAgo(h.at)}</span>{h.notes && <span>“{h.notes}”</span>}
                  </div>
                </div>
                {h.status === "resolved" && (
                  <div className="flex gap-1.5">
                    <ConfirmButton size="sm" variant="ghost" confirmLabel="Flip result?" disabled={pending} onConfirm={() => act(() => recordAttempt({ classId: h.classId, attemptId: h.id, outcome: h.outcome === "success" ? "failure" : "success" }))}>Change to {h.outcome === "success" ? "caught" : "success"}</ConfirmButton>
                    <ConfirmButton size="sm" variant="ghost" confirmLabel="Void it?" disabled={pending} onConfirm={() => act(() => voidAttempt({ attemptId: h.id }))}>Void</ConfirmButton>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Grade changes">
        {mods.length === 0 ? <p className="text-sm text-ink-soft">No grade changes yet.</p> : (
          <ul className="divide-y divide-line">
            {mods.map((m) => (
              <li key={m.id} className={cn("flex items-center gap-3 py-2 text-sm", m.revoked && "opacity-50")}>
                <span className={cn("display w-16 text-xl", m.delta > 0 ? "text-emerald-700" : "text-pen", m.revoked && "line-through")}>{formatDelta(m.delta)}</span>
                <div className="min-w-0 flex-1"><b>Class {m.className}</b><div className="text-xs text-ink-soft">{m.reason} · {timeAgo(m.at)}{m.revoked && " · reversed"}</div></div>
                {!m.revoked && <ConfirmButton size="sm" variant="ghost" confirmLabel="Reverse?" disabled={pending} onConfirm={() => act(() => revokeModification({ modId: m.id }))}>Reverse</ConfirmButton>}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
