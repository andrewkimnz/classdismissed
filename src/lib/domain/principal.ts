import type { AttemptRow, ClassRow, NoteRow, World } from "@/lib/types";

/** Teacher's Notes a class has earned (active ones only). */
export const classNotes = (w: World, classId: number): NoteRow[] => w.notes.filter((n) => n.classId === classId);

/** Attempts a class has made. Voided / cancelled ones don't count, which is how a void refunds the notes. */
export const classAttempts = (w: World, classId: number): AttemptRow[] =>
  w.attempts.filter((a) => a.classId === classId && (a.status === "resolved" || a.status === "requested"));

export const pendingDetention = (w: World, studentId: number) =>
  w.detentions.find((d) => d.studentId === studentId && d.status === "pending") ?? null;

export interface NoteBalance {
  /** Notes the class has collected in total. */
  earned: number;
  /** Notes used up by Principal's Office attempts. */
  spent: number;
  /** earned - spent (never below 0). This is the number shown to students. */
  available: number;
  /** Notes each attempt costs. */
  required: number;
}

/**
 * Attempts SPEND notes. Each attempt records how many it used (`notesSpent`, set when it was made),
 * so: available = earned - sum(notes spent by the class's attempts). A void or cancel drops the
 * attempt from that sum, which refunds exactly what it spent.
 */
export function noteBalance(w: World, classId: number): NoteBalance {
  const required = w.event.notesRequired;
  const earned = classNotes(w, classId).length;
  const spent = classAttempts(w, classId).reduce((n, a) => n + a.notesSpent, 0);
  return { earned, spent, available: Math.max(0, earned - spent), required };
}

/**
 * What a NEW attempt costs this class: the full price, or whatever notes they actually have if an exec
 * overrides the rule ("allow anyway"). A class can never go into debt.
 */
export const notesToSpend = (b: Pick<NoteBalance, "available" | "required">) => Math.min(b.required, b.available);

export type AccessBlock = "phase" | "notes";

export interface PrincipalAccess extends NoteBalance {
  eligible: boolean;
  block: AccessBlock | null;
  /** Notes still missing before the next attempt (0 when eligible). */
  needed: number;
}

/** Can this class make an attempt right now? Guidance for the exec running the room (they can still override). */
export function principalAccess(w: World, klass: Pick<ClassRow, "id">): PrincipalAccess {
  const bal = noteBalance(w, klass.id);
  const needed = Math.max(0, bal.required - bal.available);
  let block: AccessBlock | null = null;
  if (w.event.phase !== "after_school") block = "phase";
  else if (needed > 0) block = "notes";
  return { ...bal, eligible: block === null, block, needed };
}
