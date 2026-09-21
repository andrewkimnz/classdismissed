"use client";

import { useState } from "react";
import { importStudents } from "@/actions/students";
import { Field, Panel, useAct } from "@/components/admin/ui";

export function ImportForm() {
  const [text, setText] = useState("");
  const { act, pending } = useAct();
  const lines = text.split(/\r?\n/).filter((l) => l.trim()).length;
  return (
    <Panel>
      <Field label="Paste names" hint="One per line. Optionally add a class after a comma: “Jamie Lee, 2-B”. Students without a class go to the smallest class, keeping teams balanced. Duplicates are skipped.">
        <textarea className="field !min-h-[220px] font-mono text-sm" value={text} onChange={(e) => setText(e.target.value)} placeholder={"Jamie Lee\nSam Park, 1-C\nAiko Tanaka"} />
      </Field>
      <button className="btn btn-primary mt-3 w-full" disabled={pending || !lines} onClick={() => act(() => importStudents({ text }), { onOk: () => setText("") })}>{pending ? "Importing…" : `Import ${lines} student${lines === 1 ? "" : "s"}`}</button>
    </Panel>
  );
}
