"use client";

import { useState } from "react";
import { updateEventSettings } from "@/actions/event";
import { createTier, deleteTier, saveBoundaries, updateTier } from "@/actions/settings";
import { ConfirmButton, Field, Panel, Segmented, Switch, useAct } from "@/components/admin/ui";
import { validateBoundaries } from "@/lib/domain/grades";

// ── event settings ──────────────────────────────────────────────────────────
interface Ev { name: string; tagline: string; eventDate: string; timezone: string; venue: string; assemblyPoint: string; notesRequired: number; principalRoom: string; detentionRoom: string; detentionInstructions: string }

export function EventSettingsForm({ event }: { event: Ev }) {
  const [f, setF] = useState({ ...event, notesRequired: String(event.notesRequired) });
  const { act, pending } = useAct();
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((s) => ({ ...s, [k]: e.target.value }));
  return (
    <Panel title="Event & rules">
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); act(() => updateEventSettings({ ...f, notesRequired: Number(f.notesRequired) })); }}>
        <Field label="Event name"><input className="field" value={f.name} onChange={set("name")} required /></Field>
        <Field label="Tagline"><input className="field" value={f.tagline} onChange={set("tagline")} /></Field>
        <div className="grid grid-cols-2 gap-3"><Field label="Date"><input type="date" className="field" value={f.eventDate} onChange={set("eventDate")} required /></Field><Field label="Timezone"><input className="field" value={f.timezone} onChange={set("timezone")} /></Field></div>
        <div className="grid grid-cols-2 gap-3"><Field label="Venue"><input className="field" value={f.venue} onChange={set("venue")} /></Field><Field label="Assembly point"><input className="field" value={f.assemblyPoint} onChange={set("assemblyPoint")} /></Field></div>
        <div className="rounded-2xl border-2 border-dashed border-line bg-paper p-3">
          <div className="display mb-2 text-lg">Principal’s Office</div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Notes per attempt" hint="Each Principal’s Office attempt spends this many. 0 = free."><input className="field" inputMode="numeric" value={f.notesRequired} onChange={set("notesRequired")} /></Field>
            <Field label="Office room"><input className="field font-mono" value={f.principalRoom} onChange={set("principalRoom")} /></Field>
          </div>
        </div>
        <div className="grid gap-3"><Field label="Detention room"><input className="field font-mono" value={f.detentionRoom} onChange={set("detentionRoom")} /></Field><Field label="Detention instructions (students see this)"><textarea className="field" value={f.detentionInstructions} onChange={set("detentionInstructions")} /></Field></div>
        <button className="btn btn-primary w-full" disabled={pending}>Save settings</button>
      </form>
    </Panel>
  );
}

// ── grade boundaries ────────────────────────────────────────────────────────
export function BoundariesEditor({ rows }: { rows: { grade: string; minPercent: number }[] }) {
  const [list, setList] = useState(rows.map((r) => ({ grade: r.grade, min: String(r.minPercent) })));
  const { act, pending } = useAct();
  const parsed = list.map((r) => ({ grade: r.grade, minPercent: Number(r.min) }));
  const errors = validateBoundaries(parsed.map((p) => ({ ...p, minPercent: Number.isNaN(p.minPercent) ? -1 : p.minPercent })));
  const sorted = [...list].map((r, i) => ({ ...r, i })).sort((a, b) => Number(b.min) - Number(a.min));
  return (
    <Panel title="Grade boundaries">
      <p className="mb-3 text-xs text-ink-soft">A class gets the highest grade whose start it reaches. Changing this re-grades everyone immediately.</p>
      <ul className="space-y-1.5">
        {sorted.map((r, n) => (
          <li key={r.i} className="flex items-center gap-2">
            <input className="field display !min-h-[42px] w-20 text-center !text-xl" value={r.grade} maxLength={4} aria-label="Grade" onChange={(e) => setList((l) => l.map((x, j) => (j === r.i ? { ...x, grade: e.target.value } : x)))} />
            <span className="text-sm font-bold text-ink-soft">from</span>
            <input className="field !min-h-[42px] w-24 tabular" inputMode="decimal" value={r.min} aria-label={`${r.grade} starts at`} onChange={(e) => setList((l) => l.map((x, j) => (j === r.i ? { ...x, min: e.target.value.replace(/[^0-9.]/g, "") } : x)))} />
            <span className="text-sm font-bold text-ink-soft">%</span>
            <span className="ml-auto hidden text-xs text-ink-soft sm:inline">{n === 0 ? "up to 100" : `to ${Math.max(0, Number(sorted[n - 1].min) - 0.01).toFixed(2)}`}</span>
            <button className="btn btn-ghost btn-sm !px-2" aria-label={`Remove ${r.grade}`} onClick={() => setList((l) => l.filter((_, j) => j !== r.i))}>✕</button>
          </li>
        ))}
      </ul>
      {errors.length > 0 && <ul className="mt-3 rounded-xl border-2 border-pen bg-pen/5 p-2.5 text-sm font-bold text-pen">{[...new Set(errors)].map((e) => <li key={e}>⚠️ {e}</li>)}</ul>}
      <div className="mt-3 flex gap-2">
        <button className="btn btn-sm" onClick={() => setList((l) => [...l, { grade: "", min: "" }])}>+ Add grade</button>
        <button className="btn btn-primary btn-sm ml-auto" disabled={pending || errors.length > 0} onClick={() => act(() => saveBoundaries({ rows: parsed }))}>Save boundaries</button>
      </div>
    </Panel>
  );
}

// ── risk tiers ──────────────────────────────────────────────────────────────
interface Tier { id: number; name: string; description: string; icon: string; successDelta: number; failureDelta: number; failureDetention: boolean; enabled: boolean }

function TierForm({ tier, onDone }: { tier: Tier | null; onDone?: () => void }) {
  const [f, setF] = useState({ name: tier?.name ?? "", description: tier?.description ?? "", icon: tier?.icon ?? "🎲", s: String(tier?.successDelta ?? 3), fl: String(tier?.failureDelta ?? -1), det: tier?.failureDetention ?? false, on: tier?.enabled ?? true });
  const { act, pending } = useAct();
  const save = () => {
    const body = { name: f.name, description: f.description, icon: f.icon, successDelta: Number(f.s), failureDelta: Number(f.fl), failureDetention: f.det, enabled: f.on };
    act(() => (tier ? updateTier({ id: tier.id, ...body }) : createTier(body)), { onOk: () => { if (!tier) setF({ name: "", description: "", icon: "🎲", s: "3", fl: "-1", det: false, on: true }); onDone?.(); } });
  };
  return (
    <div className="space-y-2.5 rounded-2xl border-2 border-line bg-white p-3">
      <div className="grid grid-cols-[64px_1fr] gap-2"><input className="field text-center text-2xl" value={f.icon} onChange={(e) => setF({ ...f, icon: e.target.value })} maxLength={8} aria-label="Icon" /><input className="field display !text-xl" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Name" maxLength={30} aria-label="Tier name" /></div>
      <input className="field !min-h-[42px] text-sm" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Description shown to students" maxLength={200} aria-label="Description" />
      <div className="grid grid-cols-2 gap-2">
        <Field label="Success (± points)"><input className="field tabular" inputMode="decimal" value={f.s} onChange={(e) => setF({ ...f, s: e.target.value.replace(/[^0-9.\-+]/g, "") })} /></Field>
        <Field label="Failure (± points)"><input className="field tabular" inputMode="decimal" value={f.fl} onChange={(e) => setF({ ...f, fl: e.target.value.replace(/[^0-9.\-+]/g, "") })} /></Field>
      </div>
      <div className="flex items-center justify-between"><span className="text-sm font-extrabold">Failure = detention</span><Switch label="Failure causes detention" checked={f.det} onChange={(det) => setF({ ...f, det })} /></div>
      <div className="flex items-center justify-between"><span className="text-sm font-extrabold">Enabled</span><Switch label="Enabled" checked={f.on} onChange={(on) => setF({ ...f, on })} /></div>
      <div className="flex gap-2">
        <button className="btn btn-primary btn-sm flex-1" disabled={pending || !f.name.trim() || Number.isNaN(Number(f.s)) || Number.isNaN(Number(f.fl))} onClick={save}>{tier ? "Save tier" : "Add tier"}</button>
        {tier && <ConfirmButton size="sm" variant="ghost" confirmLabel="Delete?" disabled={pending} onConfirm={() => act(() => deleteTier({ id: tier.id }))}>Delete</ConfirmButton>}
      </div>
    </div>
  );
}

export function TiersEditor({ tiers }: { tiers: Tier[] }) {
  return (
    <Panel title="Risk tiers">
      <p className="mb-3 text-xs text-ink-soft">What students can gamble. Changing a tier never rewrites attempts already recorded.</p>
      <div className="grid gap-3 md:grid-cols-2">
        {tiers.map((t) => <TierForm key={`${t.id}-${t.successDelta}-${t.failureDelta}-${t.enabled}-${t.failureDetention}-${t.name}`} tier={t} />)}
        <div><div className="label mb-1">New tier</div><TierForm tier={null} /></div>
      </div>
    </Panel>
  );
}
