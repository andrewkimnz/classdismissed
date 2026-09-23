"use client";

import { clearMathToss, resetMathSession } from "@/actions/math";
import { ConfirmButton, Panel, useAct } from "@/components/admin/ui";
import { ClassBadge } from "@/components/ui/kit";
import { timeAgo } from "@/lib/domain/time";

export interface MathDeskItem {
  id: number;
  studentName: string;
  className: string | null;
  classColor: string | null;
  waiting: boolean;
  tosses: number;
  wonAt: string | null;
  lastTossedAt: string | null;
}

/** Waiting windows close themselves after a few seconds — this page is mostly for watching the queue.
 * "Clear now" just ends a window early (the student already tossed, or a mis-tap needs fixing). */
export function MathDesk({ items }: { items: MathDeskItem[] }) {
  const { act, pending } = useAct();
  const waiting = items.filter((i) => i.waiting);
  const tossed = items.filter((i) => !i.waiting);
  return (
    <div className="space-y-5">
      <Panel title={`Waiting to toss (${waiting.length})`}>
        {waiting.length === 0 ? <p className="text-sm text-ink-soft">Nobody's mid-toss right now — windows close themselves after a few seconds.</p> : (
          <ul className="space-y-2.5">
            {waiting.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center gap-2.5 rounded-2xl border-2 border-mint bg-mint/10 p-3">
                <div className="min-w-0 flex-1">
                  <div className="font-extrabold">{i.studentName}</div>
                  <div className="flex items-center gap-1.5 text-xs text-ink-soft">
                    {i.className && i.classColor && <ClassBadge name={i.className} color={i.classColor} />} won {i.wonAt ? timeAgo(i.wonAt) : ""}
                  </div>
                </div>
                <button className="btn btn-good btn-sm" disabled={pending} onClick={() => act(() => clearMathToss({ id: i.id }))}>Clear now</button>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Panel
        title={`Tossed at least once (${tossed.length})`}
        right={
          <ConfirmButton
            size="sm" variant="ghost" confirmLabel="Clear everyone's progress & restart?" disabled={pending}
            onConfirm={() => act(() => resetMathSession())}
          >
            Reset session
          </ConfirmButton>
        }
      >
        {tossed.length === 0 ? <p className="text-sm text-ink-soft">Nobody yet.</p> : (
          <ul className="divide-y divide-line">
            {tossed.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center gap-2.5 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="font-bold">{i.studentName}</div>
                  <div className="flex items-center gap-1.5 text-xs text-ink-soft">
                    {i.className && i.classColor && <ClassBadge name={i.className} color={i.classColor} />} {i.tosses} toss{i.tosses === 1 ? "" : "es"} · last {i.lastTossedAt ? timeAgo(i.lastTossedAt) : ""}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
