"use client";

import { useState } from "react";
import { createBuzzerQuestion, deleteBuzzerQuestion, moveBuzzerQuestion, updateBuzzerQuestion } from "@/actions/buzzer";
import { ConfirmButton, Field, Modal, useAct } from "@/components/admin/ui";
import { cn } from "@/lib/cn";

export interface QuestionItem {
  id: number;
  question: string;
  choices: string[];
  correctIndex: number;
}

const LETTERS = ["A", "B", "C", "D", "E", "F"];

export function BuzzerQuestionsAdmin({ questions }: { questions: QuestionItem[] }) {
  const { act, pending } = useAct();
  const [editing, setEditing] = useState<QuestionItem | "new" | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-soft">{questions.length === 0 ? "No questions prepared yet." : `${questions.length} question${questions.length === 1 ? "" : "s"}, asked in this order.`}</p>
        <button className="btn btn-primary btn-sm" onClick={() => setEditing("new")}>+ Add question</button>
      </div>

      {questions.length === 0 ? (
        <p className="card-soft p-4 text-sm text-ink-soft">Nothing stops the round running without any: "Next question" still works, the TV just shows a generic "buzz in" prompt and the exec asks their own.</p>
      ) : (
        <ol className="space-y-2.5">
          {questions.map((q, i) => (
            <li key={q.id} className="card-soft p-3.5">
              <div className="flex items-start gap-3">
                <span className="display w-7 shrink-0 text-center text-lg text-ink-soft">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="font-extrabold">{q.question}</div>
                  <ul className="mt-1.5 grid gap-1 sm:grid-cols-2">
                    {q.choices.map((c, ci) => (
                      <li key={ci} className={cn("truncate rounded-lg border-2 px-2 py-1 text-xs font-bold", ci === q.correctIndex ? "border-mint bg-mint/20" : "border-line text-ink-soft")}>
                        {LETTERS[ci]}) {c}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex shrink-0 flex-col gap-1">
                  <div className="flex gap-1">
                    <button className="btn btn-ghost btn-sm !px-2" disabled={pending || i === 0} onClick={() => act(() => moveBuzzerQuestion({ id: q.id, direction: "up" }))} aria-label="Move up">▲</button>
                    <button className="btn btn-ghost btn-sm !px-2" disabled={pending || i === questions.length - 1} onClick={() => act(() => moveBuzzerQuestion({ id: q.id, direction: "down" }))} aria-label="Move down">▼</button>
                  </div>
                  <button className="btn btn-sm" onClick={() => setEditing(q)}>Edit</button>
                  <ConfirmButton size="sm" variant="ghost" confirmLabel="Delete?" disabled={pending} onConfirm={() => act(() => deleteBuzzerQuestion({ id: q.id }))}>Delete</ConfirmButton>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}

      {editing && <QuestionModal key={editing === "new" ? "new" : editing.id} item={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function QuestionModal({ item, onClose }: { item: QuestionItem | null; onClose: () => void }) {
  const { act, pending } = useAct();
  const [question, setQuestion] = useState(item?.question ?? "");
  const [choices, setChoices] = useState<string[]>(item?.choices ?? ["", ""]);
  const [correctIndex, setCorrectIndex] = useState(item?.correctIndex ?? 0);

  const setChoice = (i: number, value: string) => setChoices((cs) => cs.map((c, ci) => (ci === i ? value : c)));
  const addChoice = () => choices.length < 6 && setChoices((cs) => [...cs, ""]);
  const removeChoice = (i: number) => {
    if (choices.length <= 2) return;
    setChoices((cs) => cs.filter((_, ci) => ci !== i));
    setCorrectIndex((ci) => (ci === i ? 0 : ci > i ? ci - 1 : ci));
  };

  const valid = question.trim() && choices.every((c) => c.trim()) && choices.length >= 2;

  return (
    <Modal open onClose={onClose} title={item ? "Edit question" : "Add question"}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          const body = { question: question.trim(), choices: choices.map((c) => c.trim()), correctIndex };
          act(() => (item ? updateBuzzerQuestion({ id: item.id, ...body }) : createBuzzerQuestion(body)), { onOk: onClose });
        }}
      >
        <Field label="Question"><textarea className="field" rows={2} value={question} onChange={(e) => setQuestion(e.target.value)} required maxLength={500} /></Field>
        <Field label="Choices" hint="Mark the correct one.">
          <div className="space-y-2">
            {choices.map((c, i) => (
              <div key={i} className="flex items-center gap-2">
                <label className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl border-2 border-ink text-sm font-extrabold" style={{ background: correctIndex === i ? "var(--mint)" : "white" }}>
                  <input type="radio" name="correct" className="sr-only" checked={correctIndex === i} onChange={() => setCorrectIndex(i)} />
                  {LETTERS[i]}
                </label>
                <input className="field flex-1" value={c} onChange={(e) => setChoice(i, e.target.value)} required maxLength={200} placeholder={`Choice ${LETTERS[i]}`} />
                {choices.length > 2 && (
                  <button type="button" className="btn btn-ghost btn-sm !px-2.5" onClick={() => removeChoice(i)} aria-label={`Remove choice ${LETTERS[i]}`}>✕</button>
                )}
              </div>
            ))}
          </div>
          {choices.length < 6 && <button type="button" className="btn btn-ghost btn-sm mt-2" onClick={addChoice}>+ Add a choice</button>}
        </Field>
        <button className="btn btn-primary w-full" disabled={pending || !valid}>{item ? "Save question" : "Add question"}</button>
      </form>
    </Modal>
  );
}
