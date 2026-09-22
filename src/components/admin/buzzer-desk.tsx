"use client";

import { clearBuzz, nextBuzzerQuestion, resolveBuzz } from "@/actions/buzzer";
import { ConfirmButton, Panel, useAct } from "@/components/admin/ui";
import { Avatar } from "@/components/ui/avatar";
import { ClassBadge } from "@/components/ui/kit";
import { timeAgo } from "@/lib/domain/time";

export interface BuzzerDeskState {
  questionNumber: number;
  buzzedStudentId: number | null;
  buzzedStudentName: string | null;
  className: string | null;
  classColor: string | null;
  photoUrl: string | null;
  buzzedAt: string | null;
  result: "correct" | "wrong" | null;
}

export interface BuzzerDeskRound {
  id: number;
  questionNumber: number;
  studentName: string | null;
  className: string | null;
  classColor: string | null;
  result: "correct" | "wrong" | "unanswered";
  resolvedAt: string;
}

export function BuzzerDesk({ state, history }: { state: BuzzerDeskState; history: BuzzerDeskRound[] }) {
  const { act, pending } = useAct();
  const started = state.questionNumber > 0;

  return (
    <div className="space-y-5">
      <Panel title={started ? `Question ${state.questionNumber}` : "Start of round"}>
        <button className="btn btn-primary btn-lg w-full" disabled={pending} onClick={() => act(() => nextBuzzerQuestion())}>
          {started ? "Next question ▶" : "Start the round ▶"}
        </button>

        <div className="mt-4">
          {state.buzzedStudentId === null ? (
            <p className="text-sm text-ink-soft">{started ? "Nobody's buzzed in yet." : "Press start when you're ready for Q1."}</p>
          ) : (
            <div className="flex items-center gap-3 rounded-2xl border-2 border-ink bg-sun p-3">
              <Avatar student={{ id: state.buzzedStudentId, name: state.buzzedStudentName ?? "Student", photoUrl: state.photoUrl }} className="h-16 w-14 shrink-0 rounded-xl border-2 border-ink" />
              <div className="min-w-0 flex-1">
                <div className="display truncate text-xl leading-tight">{state.buzzedStudentName}</div>
                <div className="flex items-center gap-1.5 text-xs font-bold text-ink-soft">
                  {state.className && state.classColor && <ClassBadge name={state.className} color={state.classColor} />}
                  buzzed {state.buzzedAt ? timeAgo(state.buzzedAt) : ""}
                  {state.result && <span className="uppercase">· {state.result}</span>}
                </div>
              </div>
            </div>
          )}
          {state.buzzedStudentId !== null && (
            <div className="mt-3 grid grid-cols-2 gap-2.5">
              <button className="btn btn-good" disabled={pending || state.result !== null} onClick={() => act(() => resolveBuzz({ result: "correct" }))}>✔ Correct</button>
              <button className="btn btn-danger" disabled={pending || state.result !== null} onClick={() => act(() => resolveBuzz({ result: "wrong" }))}>✘ Wrong</button>
            </div>
          )}
          {state.buzzedStudentId !== null && (
            <ConfirmButton className="mt-2 w-full" variant="ghost" confirmLabel="Clear the buzz?" disabled={pending} onConfirm={() => act(() => clearBuzz())}>
              Clear (mis-tap / wrong student)
            </ConfirmButton>
          )}
        </div>
      </Panel>

      <Panel title={`Scoreboard (${history.length})`}>
        {history.length === 0 ? <p className="text-sm text-ink-soft">Nothing resolved yet.</p> : (
          <ul className="divide-y divide-line">
            {history.map((r) => (
              <li key={r.id} className="flex items-center gap-2.5 py-2 text-sm">
                <span className="label w-8 shrink-0">Q{r.questionNumber}</span>
                <span className="min-w-0 flex-1 truncate font-bold">{r.studentName ?? "—"}</span>
                {r.className && r.classColor && <ClassBadge name={r.className} color={r.classColor} />}
                <span className={r.result === "correct" ? "text-emerald-700" : r.result === "wrong" ? "text-pen" : "text-ink-soft"}>
                  {r.result === "unanswered" ? "no answer" : r.result}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
