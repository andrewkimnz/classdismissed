"use client";

import { useState } from "react";
import { setAllClubsOpen, setCurrentPeriod, setLeaderboardMode, setPhase, setScoringLocked, setTimetableMode } from "@/actions/event";
import { Modal, Panel, Segmented, Switch, useAct } from "@/components/admin/ui";
import { cn } from "@/lib/cn";
import { PHASES, phaseLabel } from "@/lib/domain/phases";
import type { EventRow, Phase } from "@/lib/types";

const PHASE_STYLE: Record<Phase, string> = {
  school_day: "bg-[#8ec5ff]",
  after_school: "bg-gradient-to-br from-[#ff9e7d] to-[#ee4f86] text-white",
  event_complete: "bg-gradient-to-br from-[#3c4a8c] to-[#1f2a5a] text-white",
};
const PHASE_EMOJI: Record<Phase, string> = { school_day: "🔔", after_school: "🌸", event_complete: "🎓" };
const EFFECT: Record<Phase, string> = {
  school_day: "Students see their timetable and scores. Clubs and the Principal's Office are locked.",
  after_school: "Every phone shows the “CLASS DISMISSED” bell moment. Clubs, Teacher's Notes and the Principal's Office open.",
  event_complete: "Every phone turns its home screen into the final keepsake. Grades are final.",
};

export function PhaseControl({ phase }: { phase: Phase }) {
  const { act, pending } = useAct();
  const [target, setTarget] = useState<Phase | null>(null);
  const forward = target ? PHASES.findIndex((p) => p.key === target) > PHASES.findIndex((p) => p.key === phase) : true;
  return (
    <section className="card p-4">
      <div className="mb-3 flex items-center justify-between"><h2 className="display text-2xl">Current event phase</h2><span className="pulse-ring rounded-full bg-mint px-3 py-1 text-xs font-black uppercase tracking-widest">Live</span></div>
      <div className="grid gap-2.5 sm:grid-cols-3">
        {PHASES.map((p) => {
          const on = p.key === phase;
          return (
            <button
              key={p.key} disabled={on || pending} onClick={() => setTarget(p.key)}
              className={cn("relative min-h-[92px] rounded-2xl border-2 border-ink p-3 text-left transition-transform active:translate-y-[3px]", on ? cn(PHASE_STYLE[p.key], "shadow-[0_4px_0_var(--ink)]") : "bg-white opacity-90 hover:bg-paper-2")}
            >
              <div className="text-2xl">{PHASE_EMOJI[p.key]}</div>
              <div className="display text-2xl uppercase leading-none">{p.label}</div>
              <div className="mt-1 text-[12px] font-semibold leading-tight opacity-80">{on ? "● Current phase" : p.blurb}</div>
            </button>
          );
        })}
      </div>
      <Modal open={target !== null} onClose={() => setTarget(null)} title={target ? `Switch to ${phaseLabel(target)}?` : ""}>
        {target && (
          <div className="space-y-4">
            <p className="text-[15px]">{EFFECT[target]}</p>
            <p className="rounded-xl border-2 border-dashed border-line bg-white p-3 text-sm font-bold">
              {forward ? "This takes effect on every student's phone within a few seconds." : "⚠️ Going BACKWARDS. Students will simply see the earlier screens again. No data is lost, and you can switch forward again."}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button className="btn" onClick={() => setTarget(null)}>Cancel</button>
              <button className="btn btn-primary" disabled={pending} onClick={() => act(() => setPhase({ phase: target }), { onOk: () => setTarget(null) })}>{pending ? "Switching…" : `Yes, ${phaseLabel(target)}`}</button>
            </div>
          </div>
        )}
      </Modal>
    </section>
  );
}

export function BellControl({ event, periodCount, canManage }: { event: EventRow; periodCount: number; canManage: boolean }) {
  const { act, pending } = useAct();
  const cur = event.currentPeriod;
  const status = cur === 0 ? "Before the first bell" : cur > periodCount ? "School day finished" : `Rotation ${cur} of ${periodCount} is live`;
  const nextLabel = cur === 0 ? "🔔 Ring first bell (start rotation 1)" : cur < periodCount ? `🔔 Ring bell: start rotation ${cur + 1}` : cur === periodCount ? "🔔 Ring bell: end the school day" : null;
  return (
    <Panel title="Rotation bell">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="display text-xl">{event.timetableMode === "manual" ? status : "Following the clock"}</div>
        {canManage && <Segmented value={event.timetableMode} disabled={pending} onChange={(mode) => act(() => setTimetableMode({ mode }))} options={[{ value: "manual", label: "Bell button" }, { value: "clock", label: "Clock" }]} />}
      </div>
      {event.timetableMode === "manual" ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          {nextLabel && <button className="btn btn-sun btn-lg flex-1" disabled={pending} onClick={() => act(() => setCurrentPeriod({ period: cur + 1 }))}>{nextLabel}</button>}
          <button className="btn btn-ghost" disabled={pending || cur === 0} onClick={() => act(() => setCurrentPeriod({ period: cur - 1 }))}>↩ Back one</button>
        </div>
      ) : (
        <p className="text-sm text-ink-soft">Rotations switch automatically at the times set in Timetable. Change to “Bell button” if the night runs late.</p>
      )}
    </Panel>
  );
}

export function EventToggles({ event, canManage }: { event: EventRow; canManage: boolean }) {
  const { act, pending } = useAct();
  return (
    <Panel title="Live switches">
      <ul className="divide-y-2 divide-dashed divide-line">
        <li className="flex items-center justify-between gap-3 py-3">
          <div><div className="font-extrabold">Scoring locked</div><div className="text-xs text-ink-soft">Stops any score being saved (unlock to fix a mistake).</div></div>
          <Switch label="Scoring locked" checked={event.scoringLocked} disabled={pending || !canManage} onChange={(locked) => act(() => setScoringLocked({ locked }))} />
        </li>
        <li className="flex flex-wrap items-center justify-between gap-3 py-3">
          <div><div className="font-extrabold">Leaderboard for students</div><div className="text-xs text-ink-soft">Staff always see exact numbers.</div></div>
          <Segmented value={event.leaderboardMode} disabled={pending || !canManage} onChange={(mode) => act(() => setLeaderboardMode({ mode }))} options={[{ value: "exact", label: "Exact %" }, { value: "grades", label: "Grades" }, { value: "hidden", label: "Hidden" }]} />
        </li>
        <li className="flex items-center justify-between gap-3 py-3">
          <div><div className="font-extrabold">All clubs</div><div className="text-xs text-ink-soft">Bulk open or close every club.</div></div>
          <div className="flex gap-2">
            <button className="btn btn-sm" disabled={pending || !canManage} onClick={() => act(() => setAllClubsOpen({ open: true }))}>Open all</button>
            <button className="btn btn-sm" disabled={pending || !canManage} onClick={() => act(() => setAllClubsOpen({ open: false }))}>Close all</button>
          </div>
        </li>
      </ul>
    </Panel>
  );
}
