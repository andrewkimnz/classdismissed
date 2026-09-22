"use client";

import { useState } from "react";
import { resetEventActivity } from "@/actions/event";
import { Panel, useAct } from "@/components/admin/ui";
import type { ResetCounts } from "@/lib/reset";

/** Big, deliberate, hard to trigger by accident: type RESET, then press the button. */
export function StartFreshPanel({ counts }: { counts: ResetCounts }) {
  const [text, setText] = useState("");
  const { act, pending } = useAct();
  const ready = text.trim().toUpperCase() === "RESET";
  const items: [number, string][] = [
    [counts.scores, "class scores"], [counts.notes, "Teacher’s Notes"], [counts.clubCompletions, "club completions"],
    [counts.attempts, "Principal’s Office attempts"], [counts.gradeChanges, "grade changes"], [counts.detentions, "detentions"], [counts.checkedIn, "check-ins"],
    [counts.mathChallenges, "Maths toss attempts"], [counts.buzzerRounds, "Buzzer questions answered"],
  ];
  const nothing = items.every(([n]) => n === 0);
  return (
    <Panel title="Start the event fresh" className="border-pen">
      <p className="mb-2 text-sm">Wipes everything that happened during the event and returns to <b>School Day, before the first bell</b>.</p>
      <div className="mb-2 rounded-xl border-2 border-dashed border-pen bg-pen/5 p-3 text-sm">
        <div className="label mb-1 text-pen">Will be cleared now</div>
        {nothing ? "Nothing yet: the event is already fresh." : items.filter(([n]) => n > 0).map(([n, label]) => `${n} ${label}`).join(" · ")}
        <div className="mt-1 text-xs text-ink-soft">Everyone is marked “expected” again and custom awards are removed.</div>
      </div>
      <div className="mb-3 rounded-xl border-2 border-dashed border-line bg-white p-3 text-sm">
        <div className="label mb-1 text-emerald-700">Stays exactly as it is</div>
        Classes and their names/colours · students, numbers and login cards · ID and team photos · clubs · subjects and timetable · rules, grade boundaries and risk tiers · staff accounts · the activity log.
      </div>
      <div className="flex gap-2">
        <input className="field flex-1" placeholder="Type RESET to unlock" value={text} onChange={(e) => setText(e.target.value)} aria-label="Type RESET to confirm" autoComplete="off" />
        <button className="btn btn-danger" disabled={pending || !ready} onClick={() => act(() => resetEventActivity({ confirm: text }), { onOk: () => setText("") })}>{pending ? "Resetting…" : "Start fresh"}</button>
      </div>
    </Panel>
  );
}
