"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { ClassBadge } from "@/components/ui/kit";
import { studentTag } from "@/lib/auth/codes";
import { cn } from "@/lib/cn";

export interface PickerStudent {
  id: number;
  name: string;
  studentNo: number;
  className: string | null;
  classColor: string | null;
  photoUrl: string | null;
  /** Small extra line, e.g. "3 notes" or "IN DETENTION". */
  hint?: string;
  tone?: "bad" | "good";
}

/** Match "42", "042", "kac-42" against the number, anything else against the name. */
export function matchStudents(students: PickerStudent[], q: string, limit = 8): PickerStudent[] {
  const query = q.trim().toLowerCase();
  if (!query) return [];
  const digits = query.replace(/^kac-?/, "");
  if (/^\d+$/.test(digits)) {
    const n = Number(digits);
    return students.filter((s) => s.studentNo === n || String(s.studentNo).startsWith(digits.replace(/^0+/, "") || "0")).sort((a, b) => Number(b.studentNo === n) - Number(a.studentNo === n)).slice(0, limit);
  }
  return students.filter((s) => s.name.toLowerCase().includes(query)).slice(0, limit);
}

/**
 * Find a student fast: type part of a name or a student number (42 → KAC-042),
 Big tap targets, no typing needed beyond a few characters.
 */
export function StudentPicker({
  students, onPick, selectedIds, placeholder = "Name or student no.  (e.g. 42)", autoFocus,
}: { students: PickerStudent[]; onPick: (s: PickerStudent) => void; selectedIds?: number[]; placeholder?: string; autoFocus?: boolean }) {
  const [q, setQ] = useState("");
  const results = useMemo(() => matchStudents(students, q), [students, q]);

  return (
    <div>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-soft" />
          <input
            className="field !pl-10" value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} autoFocus={autoFocus}
            inputMode="search" autoComplete="off" autoCorrect="off" spellCheck={false} aria-label="Find a student"
          />
        </div>
      </div>
      {q && results.length === 0 && <p className="mt-2 rounded-xl border-2 border-dashed border-line bg-white p-3 text-sm text-ink-soft">No student matches “{q}”.</p>}
      {results.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {results.map((s) => {
            const on = selectedIds?.includes(s.id);
            return (
              <li key={s.id}>
                <button
                  type="button" onClick={() => { onPick(s); setQ(""); }}
                  className={cn("flex w-full items-center gap-3 rounded-2xl border-2 bg-white p-2 text-left active:scale-[0.99]", on ? "border-ink bg-sun" : "border-line")}
                >
                  <Avatar student={s} className="h-14 w-12 shrink-0 rounded-lg border-2 border-ink" />
                  <span className="min-w-0 flex-1">
                    <span className="display block truncate text-xl leading-tight">{s.name}</span>
                    <span className="flex items-center gap-2 text-xs font-bold text-ink-soft"><span className="font-mono">{studentTag(s.studentNo)}</span>{s.className && s.classColor && <ClassBadge name={s.className} color={s.classColor} />}{s.hint && <span className={s.tone === "bad" ? "text-pen" : s.tone === "good" ? "text-emerald-700" : ""}>{s.hint}</span>}</span>
                  </span>
                  {on && <span className="text-xl">✓</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
