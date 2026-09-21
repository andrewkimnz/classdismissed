"use client";

import { useState } from "react";
import { createSubject, generateRotations, savePeriods, setRotation, setRotationRoom, updateSubject } from "@/actions/timetable";
import { ConfirmButton, Field, Modal, Panel, Switch, useAct } from "@/components/admin/ui";
import { cn, readableOn } from "@/lib/cn";

interface Subject { id: number; name: string; tagline: string; description: string; activity: string; icon: string; color: string; maxScore: number; rooms: string[]; active: boolean }
interface Props {
  classes: { id: number; name: string; color: string }[];
  subjects: Subject[];
  periods: { id: number; number: number; start: string; end: string }[];
  rotations: { periodId: number; classId: number; subjectId: number; room: string }[];
  issues: { kind: string; message: string; cells: string[] }[];
  canManage: boolean;
}

export function TimetableAdmin({ classes, subjects, periods, rotations, issues, canManage }: Props) {
  const { act, pending } = useAct();
  const [times, setTimes] = useState(periods.map((p) => ({ start: p.start, end: p.end })));
  const [editing, setEditing] = useState<Subject | "new" | null>(null);
  const bad = new Set(issues.flatMap((i) => i.cells));
  const active = subjects.filter((s) => s.active);
  const cell = (periodId: number, classId: number) => rotations.find((r) => r.periodId === periodId && r.classId === classId);

  return (
    <div className="space-y-5">
      <Panel title="Rotation times" right={<span className="text-xs font-bold text-ink-soft">event timezone</span>}>
        <ul className="space-y-2">
          {times.map((t, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="display w-24 text-lg">Period {i + 1}</span>
              <input type="time" className="field !min-h-[44px] flex-1" value={t.start} disabled={!canManage} onChange={(e) => setTimes((a) => a.map((x, j) => (j === i ? { ...x, start: e.target.value } : x)))} aria-label={`Period ${i + 1} start`} />
              <span>→</span>
              <input type="time" className="field !min-h-[44px] flex-1" value={t.end} disabled={!canManage} onChange={(e) => setTimes((a) => a.map((x, j) => (j === i ? { ...x, end: e.target.value } : x)))} aria-label={`Period ${i + 1} end`} />
            </li>
          ))}
        </ul>
        {canManage && (
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="btn btn-sm" onClick={() => setTimes((a) => { const last = a.at(-1); const [h, m] = (last?.end ?? "18:30").split(":").map(Number); const e = h * 60 + m + 10; return [...a, { start: last?.end ?? "18:30", end: `${String(Math.floor(e / 60) % 24).padStart(2, "0")}:${String(e % 60).padStart(2, "0")}` }]; })}>+ Add period</button>
            <button className="btn btn-ghost btn-sm" disabled={times.length <= 1} onClick={() => setTimes((a) => a.slice(0, -1))}>Remove last</button>
            <button className="btn btn-primary btn-sm ml-auto" disabled={pending} onClick={() => act(() => savePeriods({ periods: times }))}>Save times</button>
          </div>
        )}
      </Panel>

      <Panel title="Timetable matrix" right={canManage && <ConfirmButton size="sm" variant="plain" confirmLabel="Replace everything?" disabled={pending} onConfirm={() => act(() => generateRotations())}>✨ Auto-generate</ConfirmButton>}>
        <p className="mb-3 text-xs text-ink-soft">Every class visits every subject once, with no shared rooms. Tweak any cell; problems light up red.</p>
        <div className="-mx-4 overflow-x-auto px-4">
          <table className="w-full min-w-[640px] border-separate border-spacing-1.5 text-sm">
            <thead><tr><th className="w-16" />{periods.map((p) => <th key={p.id} className="display text-left text-base">Period {p.number}<div className="text-[11px] font-bold text-ink-soft">{p.start}–{p.end}</div></th>)}</tr></thead>
            <tbody>
              {classes.map((c) => (
                <tr key={c.id}>
                  <th className="align-top"><span className="display inline-block rounded-lg px-2 py-1 text-lg" style={{ background: c.color, color: readableOn(c.color) }}>{c.name}</span></th>
                  {periods.map((p) => {
                    const r = cell(p.id, c.id);
                    const flagged = bad.has(`${p.id}:${c.id}`);
                    const subj = subjects.find((s) => s.id === r?.subjectId);
                    return (
                      <td key={p.id} className={cn("rounded-xl border-2 p-1.5 align-top", flagged ? "border-pen bg-pen/5" : "border-line bg-white")}>
                        <select
                          className="field !min-h-[38px] !border !px-2 !py-1 text-sm font-bold" disabled={!canManage || pending} value={r?.subjectId ?? ""} aria-label={`${c.name} period ${p.number} subject`}
                          onChange={(e) => act(() => setRotation({ periodId: p.id, classId: c.id, subjectId: e.target.value ? Number(e.target.value) : null, room: r?.room ?? "" }), { silent: true })}
                          style={subj ? { background: subj.color + "22" } : undefined}
                        >
                          <option value="">—</option>
                          {active.map((s) => <option key={s.id} value={s.id}>{s.icon} {s.name}</option>)}
                        </select>
                        <input
                          key={r?.room ?? ""} defaultValue={r?.room ?? ""} placeholder="room" disabled={!r || pending} aria-label={`${c.name} period ${p.number} room`}
                          className="field mt-1 !min-h-[34px] !border !px-2 !py-0.5 font-mono text-xs"
                          onBlur={(e) => { const room = e.target.value.trim(); if (r && room !== r.room) act(() => (canManage ? setRotation({ periodId: p.id, classId: c.id, subjectId: r.subjectId, room }) : setRotationRoom({ periodId: p.id, classId: c.id, room }))); }}
                          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {issues.length > 0 ? (
          <ul className="mt-3 space-y-1 rounded-xl border-2 border-pen bg-pen/5 p-3 text-sm font-bold text-pen">{issues.map((i, n) => <li key={n}>⚠️ {i.message}</li>)}</ul>
        ) : <p className="mt-3 text-sm font-bold text-emerald-700">✓ No collisions: every class has a full, conflict-free day.</p>}
      </Panel>

      <Panel title="Subjects" right={canManage && <button className="btn btn-sm btn-primary" onClick={() => setEditing("new")}>+ Add subject</button>}>
        <ul className="grid gap-2.5 sm:grid-cols-2">
          {subjects.map((s) => (
            <li key={s.id} className={cn("rounded-2xl border-2 border-line bg-white p-3", !s.active && "opacity-55")}>
              <div className="flex items-center gap-2.5"><span className="text-3xl">{s.icon}</span><div className="min-w-0 flex-1"><div className="display text-xl leading-tight">{s.name}</div><div className="text-xs font-bold text-ink-soft">out of {s.maxScore} · rooms {s.rooms.join(", ") || "—"}</div></div>{canManage && <button className="btn btn-sm" onClick={() => setEditing(s)}>Edit</button>}</div>
              {s.tagline && <div className="hand mt-1 text-lg leading-none text-sakura-deep">{s.tagline}</div>}
            </li>
          ))}
        </ul>
      </Panel>
      {editing && <SubjectModal key={editing === "new" ? "new" : editing.id} subject={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function SubjectModal({ subject, onClose }: { subject: Subject | null; onClose: () => void }) {
  const { act, pending } = useAct();
  const [f, setF] = useState({
    name: subject?.name ?? "", tagline: subject?.tagline ?? "", description: subject?.description ?? "", activity: subject?.activity ?? "", icon: subject?.icon ?? "📚",
    color: subject?.color ?? "#4F7CFF", maxScore: String(subject?.maxScore ?? 20), rooms: subject?.rooms.join(", ") ?? "", active: subject?.active ?? true,
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((s) => ({ ...s, [k]: e.target.value }));
  return (
    <Modal open onClose={onClose} title={subject ? `Edit ${subject.name}` : "Add subject"}>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); const body = { ...f, maxScore: Number(f.maxScore) }; act(() => (subject ? updateSubject({ id: subject.id, ...body }) : createSubject(body)), { onOk: onClose }); }}>
        <div className="grid grid-cols-[80px_1fr] gap-3"><Field label="Icon"><input className="field text-center text-2xl" value={f.icon} onChange={set("icon")} maxLength={8} /></Field><Field label="Name"><input className="field" value={f.name} onChange={set("name")} required maxLength={40} /></Field></div>
        <Field label="Tagline" hint="Organiser reference only. Not shown to students."><input className="field" value={f.tagline} onChange={set("tagline")} maxLength={120} placeholder="Try not to get caught." /></Field>
        <Field label="Activity notes" hint="Organiser reference only. Not shown to students."><textarea className="field" value={f.activity} onChange={set("activity")} maxLength={600} /></Field>
        <Field label="Description" hint="Organiser reference only. Not shown to students."><textarea className="field" value={f.description} onChange={set("description")} maxLength={400} /></Field>
        <div className="grid grid-cols-2 gap-3"><Field label="Out of (max mark)"><input className="field" inputMode="numeric" value={f.maxScore} onChange={set("maxScore")} /></Field><Field label="Colour"><input type="color" className="field !p-1" value={f.color} onChange={set("color")} /></Field></div>
        <Field label="Room pool" hint="Comma separated. Auto-generate gives each class in the same subject its own room."><input className="field font-mono" value={f.rooms} onChange={set("rooms")} placeholder="201-315, 201-323" /></Field>
        <div className="flex items-center justify-between rounded-xl border-2 border-line bg-white p-3"><div><div className="font-extrabold">Active</div><div className="text-xs text-ink-soft">Inactive subjects are ignored by scoring and auto-generate.</div></div><Switch label="Active" checked={f.active} onChange={(active) => setF((s) => ({ ...s, active }))} /></div>
        <button className="btn btn-primary w-full" disabled={pending || !f.name.trim()}>Save subject</button>
      </form>
    </Modal>
  );
}
