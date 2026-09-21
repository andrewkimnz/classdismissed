import type { World } from "@/lib/types";
import { computeStandings, formatPct, type ClassResult } from "./grades";

export interface StudentStats {
  studentId: number;
  /** Class-level: everything below except `detentions` is what the student's TEAM did. */
  notes: number; // Teacher's Notes the class collected (total, before any were spent)
  clubsCompleted: number;
  attempts: number; // Principal's Office attempts the class made
  successes: number;
  failures: number;
  detentions: number; // this student's own (pending + served)
}

export interface ClassStats {
  classId: number;
  notes: number;
  clubsCompleted: number;
  attempts: number;
  successes: number;
  failures: number;
  /** Detention events: a whole-class detention from one failed attempt counts once. */
  detentions: number;
  members: number;
}

export function computeClassStats(w: World): Map<number, ClassStats> {
  const out = new Map<number, ClassStats>();
  for (const c of w.classes) {
    const attempts = w.attempts.filter((a) => a.classId === c.id && a.status === "resolved");
    const memberIds = new Set(w.students.filter((s) => s.classId === c.id).map((s) => s.id));
    const dets = w.detentions.filter((d) => d.status !== "cancelled" && memberIds.has(d.studentId));
    const events = new Set(dets.filter((d) => d.attemptId !== null).map((d) => d.attemptId)).size + dets.filter((d) => d.attemptId === null).length;
    out.set(c.id, {
      classId: c.id,
      notes: w.notes.filter((n) => n.classId === c.id).length,
      clubsCompleted: w.completions.filter((x) => x.classId === c.id).length,
      attempts: attempts.length,
      successes: attempts.filter((a) => a.outcome === "success").length,
      failures: attempts.filter((a) => a.outcome === "failure").length,
      detentions: events,
      members: memberIds.size,
    });
  }
  return out;
}

export function computeStudentStats(w: World): Map<number, StudentStats> {
  const cls = computeClassStats(w);
  const out = new Map<number, StudentStats>();
  for (const s of w.students) {
    const c = s.classId === null ? undefined : cls.get(s.classId);
    out.set(s.id, {
      studentId: s.id,
      notes: c?.notes ?? 0,
      clubsCompleted: c?.clubsCompleted ?? 0,
      attempts: c?.attempts ?? 0,
      successes: c?.successes ?? 0,
      failures: c?.failures ?? 0,
      detentions: w.detentions.filter((d) => d.studentId === s.id && d.status !== "cancelled").length,
    });
  }
  return out;
}

export interface Award {
  title: string;
  blurb: string;
}

/** Rule-based "special award". An organiser-set custom award always wins. */
export function awardFor(stats: StudentStats, custom?: string | null): Award {
  if (custom?.trim()) return { title: custom.trim().toUpperCase(), blurb: "Personally awarded by the staff room." };
  if (stats.successes >= 1) return { title: "ACADEMIC FRAUDSTER", blurb: "Altered official school records and (almost) got away with it." };
  if (stats.detentions >= 2) return { title: "REPEAT OFFENDER", blurb: "The staff room knows your name. And your parents' number." };
  if (stats.attempts >= 1) return { title: "CAUGHT RED-HANDED", blurb: "Bold plan. Terrible stealth." };
  if (stats.detentions >= 1) return { title: "CRUMB SUSPECT", blurb: "Seen near the scene with suspicious snack breath." };
  if (stats.clubsCompleted >= 4) return { title: "CLUB PRESIDENT", blurb: "Joined everything. Finished everything. Sleep is optional." };
  if (stats.notes >= 3) return { title: "TEACHER'S PET", blurb: "Collected notes like they were collectible cards." };
  if (stats.notes >= 1) return { title: "MODEL STUDENT", blurb: "Quietly excellent. Suspiciously well-behaved." };
  return { title: "MYSTERIOUS TRANSFER STUDENT", blurb: "Nobody saw you arrive. Nobody saw you leave." };
}

export interface StatEntry {
  id: number;
  name: string;
  sub?: string;
  color?: string;
  value: number;
  display: string;
  isWinner: boolean;
}

export interface StatBoard {
  id: string;
  title: string;
  emoji: string;
  scope: "class" | "student";
  blurb: string;
  entries: StatEntry[];
}

/**
 * The flexible final-stats engine. Each definition picks a value per class or
 * student; boards rank descending, drop zeros (unless told otherwise) and mark
 * every tied leader as a winner. Add a new stat by adding one line here.
 */
export function computeFinalStats(w: World, limit = 5): StatBoard[] {
  const standings = computeStandings(w);
  const classStats = computeClassStats(w);
  const classOf = (id: number | null) => w.classes.find((c) => c.id === id);

  type ClassDef = { id: string; title: string; emoji: string; blurb: string; value: (r: ClassResult) => number | null; display: (r: ClassResult, v: number) => string; keepZero?: boolean };
  const classDefs: ClassDef[] = [
    { id: "highest-final", title: "Highest Final Grade", emoji: "🏆", blurb: "The class that leaves with the best (possibly forged) report card.", value: (r) => r.currentPct, display: (r) => `${formatPct(r.currentPct)} · ${r.currentGrade}`, keepZero: true },
    { id: "highest-original", title: "Highest Original Grade", emoji: "📚", blurb: "Honest marks, before anyone touched the Principal's laptop.", value: (r) => r.originalPct, display: (r) => `${formatPct(r.originalPct)} · ${r.originalGrade}`, keepZero: true },
    { id: "biggest-increase", title: "Biggest Grade Increase", emoji: "📈", blurb: "Most points stolen from the school records.", value: (r) => (r.change > 0 ? r.change : null), display: (_r, v) => `+${v}%` },
    { id: "biggest-decrease", title: "Biggest Grade Decrease", emoji: "📉", blurb: "Greed is a poor study strategy.", value: (r) => (r.change < 0 ? -r.change : null), display: (_r, v) => `−${v}%` },
    { id: "class-attempts", title: "Most Principal's Office Attempts", emoji: "🕵️", blurb: "A whole class with a fixation on one laptop.", value: (r) => classStats.get(r.klass.id)?.attempts ?? 0, display: (_r, v) => `${v} attempts` },
    { id: "class-breakins", title: "Most Successful Break-ins", emoji: "🔓", blurb: "Professionals.", value: (r) => classStats.get(r.klass.id)?.successes ?? 0, display: (_r, v) => `${v} break-ins` },
    { id: "class-detentions", title: "Most Detentions", emoji: "🚨", blurb: "Class 'delinquent of the year'.", value: (r) => classStats.get(r.klass.id)?.detentions ?? 0, display: (_r, v) => `${v} detentions` },
    { id: "class-notes", title: "Most Teacher's Notes", emoji: "📝", blurb: "The teachers' favourite class (allegedly).", value: (r) => classStats.get(r.klass.id)?.notes ?? 0, display: (_r, v) => `${v} notes` },
    { id: "class-clubs", title: "Most Clubs Completed", emoji: "🎒", blurb: "Extracurricular overachievers.", value: (r) => classStats.get(r.klass.id)?.clubsCompleted ?? 0, display: (_r, v) => `${v} clubs` },
  ];

  const classBoards: StatBoard[] = classDefs.map((d) => {
    const raw = standings
      .map((r) => ({ r, v: d.value(r) }))
      .filter((x): x is { r: ClassResult; v: number } => x.v !== null && (d.keepZero || x.v > 0))
      .sort((a, b) => b.v - a.v || a.r.klass.name.localeCompare(b.r.klass.name));
    const top = raw[0]?.v;
    return {
      id: d.id, title: d.title, emoji: d.emoji, blurb: d.blurb, scope: "class" as const,
      entries: raw.slice(0, limit).map(({ r, v }) => ({
        id: r.klass.id, name: `Class ${r.klass.name}`, color: r.klass.color, value: v, display: d.display(r, v), isWinner: v === top,
      })),
    };
  });

  // Notes, clubs and attempts are TEAM results now, so the only individual board is the rap sheet.
  type StudentDef = { id: string; title: string; emoji: string; blurb: string; value: (id: number) => number; display: (id: number) => string };
  const own = (id: number) => w.detentions.filter((d) => d.studentId === id && d.status !== "cancelled");
  const studentDefs: StudentDef[] = [
    {
      id: "most-wanted", title: "Most Wanted Student", emoji: "🚔", blurb: "The repeat offender. Their file is thicker than the textbook.",
      // Total detentions first; personal ones (not handed out to the whole team) break ties.
      value: (id) => own(id).length * 100 + own(id).filter((d) => d.attemptId === null).length,
      display: (id) => `${own(id).length} detention${own(id).length === 1 ? "" : "s"}`,
    },
  ];

  const studentBoards: StatBoard[] = studentDefs.map((d) => {
    const raw = w.students
      .map((st) => ({ st, v: d.value(st.id) }))
      .filter((x) => x.v > 0)
      .sort((a, b) => b.v - a.v || a.st.name.localeCompare(b.st.name));
    const top = raw[0]?.v;
    return {
      id: d.id, title: d.title, emoji: d.emoji, blurb: d.blurb, scope: "student" as const,
      entries: raw.slice(0, limit).map(({ st, v }) => ({
        id: st.id,
        name: st.name,
        sub: classOf(st.classId) ? `Class ${classOf(st.classId)!.name}` : undefined,
        color: classOf(st.classId)?.color,
        value: v,
        display: d.display(st.id),
        isWinner: v === top,
      })),
    };
  });

  return [...classBoards, ...studentBoards];
}
