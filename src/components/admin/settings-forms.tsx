"use client";

import { useState } from "react";
import { updateEventSettings } from "@/actions/event";
import { saveBoundaries } from "@/actions/settings";
import { Field, Panel, useAct } from "@/components/admin/ui";
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
