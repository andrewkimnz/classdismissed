"use client";

import { useState } from "react";
import { awardBonusNote, awardClub, revokeCompletion, revokeNote } from "@/actions/notes";
import { ConfirmButton, Field, Panel, useAct } from "@/components/admin/ui";
import { Chip } from "@/components/ui/kit";
import { cn, readableOn } from "@/lib/cn";
import { timeAgo } from "@/lib/domain/time";

interface Props {
  classes: { id: number; name: string; color: string; earned: number; available: number; required: number; members: number }[];
  clubs: { id: number; name: string; icon: string; color: string; awardsNote: boolean; isOpen: boolean }[];
  done: string[]; // `${classId}:${clubId}`
  recent: { id: number; classId: number; kind: "completion" | "bonus"; createdAt: string; label: string; byName: string | null }[];
}

/** club → class(es) → one big button. The team walks around together, so the CLASS earns the note. */
export function NotesDesk({ classes, clubs, done, recent }: Props) {
  const [clubId, setClubId] = useState<number | "bonus" | null>(clubs[0]?.id ?? null);
  const [picked, setPicked] = useState<number[]>([]);
  const [reason, setReason] = useState("");
  const { act, pending } = useAct();
  const club = (typeof clubId === "number" ? clubs.find((c) => c.id === clubId) : undefined) ?? null;
  const className = (id: number) => classes.find((c) => c.id === id)?.name ?? `#${id}`;
  const already = (classId: number) => club !== null && done.includes(`${classId}:${club.id}`);
  const toggle = (id: number) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const canGo = picked.length > 0 && (club !== null || (clubId === "bonus" && reason.trim().length > 0));

  function award() {
    if (club) act(() => awardClub({ classIds: picked, clubId: club.id }), { onOk: () => setPicked([]) });
    else if (clubId === "bonus") act(async () => {
      for (const classId of picked) {
        const r = await awardBonusNote({ classId, reason });
        if (!r.ok) return r;
      }
      return { ok: true as const, message: `Bonus note for ${picked.map((id) => `Class ${className(id)}`).join(", ")}.` };
    }, { onOk: () => { setPicked([]); setReason(""); } });
  }

  const names = picked.map((id) => `Class ${className(id)}`);
  return (
    <div className="space-y-5">
      <Panel title="1 · Which club?">
        <div className="flex flex-wrap gap-2">
          {clubs.map((c) => (
            <button key={c.id} onClick={() => setClubId(c.id)} className={cn("flex min-h-[52px] items-center gap-2 rounded-2xl border-2 border-ink px-3.5 text-left active:translate-y-0.5", clubId === c.id ? "bg-ink text-white shadow-[0_3px_0_rgba(0,0,0,.35)]" : "bg-white")}>
              <span className="text-2xl">{c.icon}</span>
              <span><span className="display block text-[17px] leading-none">{c.name}</span><span className={cn("text-[10px] font-extrabold uppercase tracking-wider", clubId === c.id ? "text-white/70" : "text-ink-soft")}>{c.awardsNote ? "gives a note" : "no note"}{!c.isOpen && " · closed"}</span></span>
            </button>
          ))}
          <button onClick={() => setClubId("bonus")} className={cn("flex min-h-[52px] items-center gap-2 rounded-2xl border-2 border-dashed border-ink px-3.5 active:translate-y-0.5", clubId === "bonus" ? "bg-sun" : "bg-white")}><span className="text-2xl">⭐</span><span className="display text-[17px]">Bonus note</span></button>
        </div>
        {clubId === "bonus" && <Field label="What's it for?" className="mt-3"><input className="field" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. helped clean up" maxLength={140} /></Field>}
      </Panel>

      <Panel title="2 · Which class?" right={picked.length > 0 ? <button className="btn btn-ghost btn-sm" onClick={() => setPicked([])}>Clear</button> : undefined}>
        <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {classes.map((c) => {
            const on = picked.includes(c.id);
            const dup = already(c.id);
            return (
              <li key={c.id}>
                <button
                  onClick={() => toggle(c.id)} aria-pressed={on}
                  className={cn("w-full rounded-2xl border-2 p-2.5 text-left active:scale-[0.98]", on ? "border-ink bg-sun shadow-[0_3px_0_var(--ink)]" : dup ? "border-line bg-paper-2 opacity-70" : "border-line bg-white")}
                >
                  <span className="display inline-block rounded-lg px-2.5 py-0.5 text-2xl leading-tight" style={{ background: c.color, color: readableOn(c.color) }}>{c.name}</span>
                  <span className="mt-1 block text-xs font-bold text-ink-soft">📝 {c.available} left · {c.earned} earned</span>
                  {dup && <span className="mt-0.5 block text-[10px] font-extrabold uppercase tracking-wider text-pen">already done</span>}
                </button>
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-xs text-ink-soft">Tap several classes to award a whole set of teams at once.</p>
      </Panel>

      <button className="btn btn-good btn-lg sticky bottom-24 z-10 w-full md:bottom-4" disabled={!canGo || pending} onClick={award}>
        {pending ? "Awarding…" : !canGo ? "Pick a club and a class" : `📝 Award ${club ? club.name : "bonus"} ${club && !club.awardsNote ? "completion" : "note"} → ${names.join(", ")}`}
      </button>

      <Panel title="Recent awards" right={<Chip tone="soft">undo any of these</Chip>}>
        {recent.length === 0 ? <p className="text-sm text-ink-soft">Nothing awarded yet.</p> : (
          <ul className="divide-y divide-line">
            {recent.map((r) => (
              <li key={`${r.kind}${r.id}`} className="flex items-center gap-3 py-2">
                <div className="min-w-0 flex-1 text-sm"><b>Class {className(r.classId)}</b> · {r.kind === "completion" ? r.label : `⭐ ${r.label}`}<div className="text-xs text-ink-soft">{timeAgo(r.createdAt)} · {r.byName ?? "staff"}</div></div>
                <ConfirmButton size="sm" variant="ghost" confirmLabel="Revoke?" disabled={pending} onConfirm={() => act(() => (r.kind === "completion" ? revokeCompletion({ completionId: r.id }) : revokeNote({ noteId: r.id })))}>Undo</ConfirmButton>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
