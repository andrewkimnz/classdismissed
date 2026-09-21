"use client";

import { useState } from "react";
import { clearScore, saveScore } from "@/actions/scoring";
import { ConfirmButton, useAct } from "@/components/admin/ui";
import { Chip } from "@/components/ui/kit";
import { cn, readableOn } from "@/lib/cn";

interface Props {
  classes: { id: number; name: string; color: string }[];
  subjects: { id: number; name: string; icon: string; color: string; maxScore: number }[];
  scores: { classId: number; subjectId: number; score: number }[];
  /** classId → subjectId they're in RIGHT NOW (from the rotation bell) */
  liveSubject: Record<number, number | null>;
  locked: boolean;
}

/** Rapid class score entry: pick a subject, type a mark per class, tap save. */
export function ScoringDesk({ classes, subjects, scores, liveSubject, locked }: Props) {
  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? 0);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const { act, pending } = useAct();
  const subject = subjects.find((s) => s.id === subjectId);
  if (!subject) return <p>No subjects yet. Add some under Timetable &amp; subjects.</p>;

  const saved = (classId: number, sid = subjectId) => scores.find((s) => s.classId === classId && s.subjectId === sid)?.score ?? null;
  const key = (classId: number) => `${classId}:${subjectId}`;
  const value = (classId: number) => drafts[key(classId)] ?? (saved(classId) === null ? "" : String(saved(classId)));

  const rows = [...classes].sort((a, b) => Number(liveSubject[b.id] === subjectId) - Number(liveSubject[a.id] === subjectId));

  return (
    <div>
      {locked && <p className="mb-3 rounded-xl border-2 border-pen bg-pen/10 p-3 text-sm font-bold text-pen">🔒 Scoring is locked. An admin can unlock it in Event control.</p>}
      <div role="tablist" className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {subjects.map((s) => {
          const done = classes.filter((c) => saved(c.id, s.id) !== null).length;
          const on = s.id === subjectId;
          return (
            <button key={s.id} role="tab" aria-selected={on} onClick={() => setSubjectId(s.id)} className={cn("rounded-2xl border-2 border-ink p-2.5 text-left active:translate-y-0.5", on ? "bg-ink text-white shadow-[0_3px_0_rgba(0,0,0,0.3)]" : "bg-white")}>
              <div className="text-2xl leading-none">{s.icon}</div>
              <div className="display mt-1 truncate text-[17px] leading-tight">{s.name}</div>
              <div className={cn("text-xs font-bold", on ? "text-white/70" : "text-ink-soft")}>{done}/{classes.length} marked · /{s.maxScore}</div>
            </button>
          );
        })}
      </div>

      <ul className="space-y-2.5">
        {rows.map((c) => {
          const s0 = saved(c.id);
          const draft = value(c.id);
          const num = draft.trim() === "" ? null : Number(draft);
          const dirty = num !== s0 && !(num === null && s0 === null);
          const invalid = num !== null && (Number.isNaN(num) || num < 0 || num > subject.maxScore);
          const live = liveSubject[c.id] === subjectId;
          const submit = () => {
            if (num === null || invalid || locked) return;
            act(() => saveScore({ classId: c.id, subjectId, score: num }), { onOk: () => setDrafts((d) => { const n = { ...d }; delete n[key(c.id)]; return n; }) });
          };
          return (
            <li key={c.id} className={cn("flex items-center gap-2.5 rounded-2xl border-2 bg-white p-2.5", live ? "border-ink shadow-[0_3px_0_var(--ink)]" : "border-line")}>
              <div className="w-[68px] shrink-0 text-center">
                <span className="display inline-block rounded-lg px-2 py-1 text-2xl leading-none" style={{ background: c.color, color: readableOn(c.color) }}>{c.name}</span>
                {live && <div className="mt-1"><Chip tone="accent" className="!px-1.5 !text-[9px]">in here now</Chip></div>}
              </div>
              <div className="flex min-w-0 flex-1 items-center gap-1.5">
                <input
                  className={cn("field display text-center !text-[28px]", invalid && "!border-pen bg-pen/5")} style={{ minHeight: 56, maxWidth: 96 }}
                  inputMode="decimal" value={draft} placeholder="–" aria-label={`${c.name} ${subject.name} score`} disabled={locked}
                  onChange={(e) => setDrafts((d) => ({ ...d, [key(c.id)]: e.target.value.replace(/[^0-9.]/g, "") }))}
                  onKeyDown={(e) => e.key === "Enter" && submit()} onFocus={(e) => e.currentTarget.select()}
                />
                <span className="display whitespace-nowrap text-xl text-ink-soft">/ {subject.maxScore}</span>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <button className={cn("btn btn-sm min-w-[84px]", dirty && !invalid ? "btn-primary" : "")} disabled={!dirty || invalid || pending || locked || num === null} onClick={submit}>
                  {dirty ? "SAVE" : s0 === null ? "—" : "✓ Saved"}
                </button>
                {s0 !== null && !locked && <ConfirmButton size="sm" variant="ghost" confirmLabel="Clear it" className="!min-h-[26px] !px-2 !text-xs" onConfirm={() => act(() => clearScore({ classId: c.id, subjectId }))}>clear</ConfirmButton>}
              </div>
            </li>
          );
        })}
      </ul>
      {classes.some((c) => saved(c.id) === null) ? null : <p className="hand mt-3 text-center text-2xl text-emerald-700">All classes marked for {subject.name} ✓</p>}
    </div>
  );
}
