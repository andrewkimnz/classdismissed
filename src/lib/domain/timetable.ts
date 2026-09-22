import type { ClassRow, EventRow, PeriodRow, RotationRow, SubjectRow, World } from "@/lib/types";

export type PeriodStatus = "upcoming" | "now" | "complete";

export function periodStatus(event: EventRow, period: PeriodRow, now: number): PeriodStatus {
  if (event.timetableMode === "manual") {
    if (period.number < event.currentPeriod) return "complete";
    if (period.number === event.currentPeriod) return "now";
    return "upcoming";
  }
  if (now < period.startsAt.getTime()) return "upcoming";
  if (now < period.endsAt.getTime()) return "now";
  return "complete";
}

export interface TimetableRow {
  period: PeriodRow;
  rotation: RotationRow | null;
  subject: SubjectRow | null;
  room: string;
  status: PeriodStatus;
}

/** A class's own rotation schedule, in period order. */
export function classTimetable(w: World, classId: number, now = Date.now()): TimetableRow[] {
  return [...w.periods]
    .sort((a, b) => a.number - b.number)
    .map((period) => {
      const rotation = w.rotations.find((r) => r.periodId === period.id && r.classId === classId) ?? null;
      const subject = rotation ? (w.subjects.find((s) => s.id === rotation.subjectId) ?? null) : null;
      return { period, rotation, subject, room: rotation?.room ?? "", status: periodStatus(w.event, period, now) };
    });
}

export function currentAndNext(rows: TimetableRow[]) {
  const current = rows.find((r) => r.status === "now") ?? null;
  const next = rows.find((r) => r.status === "upcoming") ?? null;
  const allDone = rows.length > 0 && rows.every((r) => r.status === "complete");
  return { current, next, allDone };
}

export interface SubjectSlot {
  periodId: number;
  subject: SubjectRow;
}

/**
 * Is this class, right now, in whichever subject `flag` picks out? Only during School Day (After
 * School and Event Complete have no periods running). A student with no class yet (checked in
 * without one assigned) is never eligible. Shared by every "mini-game tied to one subject" feature
 * (the Maths toss challenge, the Buzzer round, and whatever comes after those) — the game-specific
 * code just supplies which boolean column on `subjects` marks its subject.
 */
export function currentSubjectSlot(w: World, classId: number | null, flag: (s: SubjectRow) => boolean): SubjectSlot | null {
  if (w.event.phase !== "school_day" || classId === null) return null;
  const { current } = currentAndNext(classTimetable(w, classId));
  if (!current?.subject || !flag(current.subject)) return null;
  return { periodId: current.period.id, subject: current.subject };
}

export type SubjectSlotStatus = "not_school_day" | "no_class" | "upcoming" | "complete" | "not_scheduled";

/** Why a class can't play right now, for a friendly message (not shown when `currentSubjectSlot` finds a slot). */
export function subjectStatusForClass(w: World, classId: number | null, flag: (s: SubjectRow) => boolean): SubjectSlotStatus {
  if (w.event.phase !== "school_day") return "not_school_day";
  if (classId === null) return "no_class";
  const rows = classTimetable(w, classId);
  const row = rows.find((r) => r.subject && flag(r.subject));
  if (!row) return "not_scheduled";
  return row.status === "upcoming" ? "upcoming" : "complete"; // "now" can't reach here: currentSubjectSlot would have matched
}

/** Next instant a clock-mode timetable changes status (so phones can refresh on the dot). */
export function nextClockBoundary(w: World, now: number): number | null {
  if (w.event.timetableMode !== "clock") return null;
  const edges = w.periods.flatMap((p) => [p.startsAt.getTime(), p.endsAt.getTime()]).filter((t) => t > now);
  return edges.length ? Math.min(...edges) : null;
}

export interface TimetableIssue {
  kind: "missing" | "repeat" | "room";
  message: string;
  cells: string[]; // `${periodId}:${classId}`
}

/** Collision / gap detection for the admin matrix. */
export function timetableIssues(w: World): TimetableIssue[] {
  const issues: TimetableIssue[] = [];
  const key = (p: number, c: number) => `${p}:${c}`;
  for (const p of w.periods) {
    for (const c of w.classes) {
      if (!w.rotations.some((r) => r.periodId === p.id && r.classId === c.id)) {
        issues.push({ kind: "missing", message: `${c.name} has nothing in period ${p.number}.`, cells: [key(p.id, c.id)] });
      }
    }
    const byRoom = new Map<string, RotationRow[]>();
    for (const r of w.rotations.filter((x) => x.periodId === p.id && x.room.trim())) {
      const k = r.room.trim().toLowerCase();
      byRoom.set(k, [...(byRoom.get(k) ?? []), r]);
    }
    for (const [room, rs] of byRoom) {
      if (rs.length > 1) {
        const names = rs.map((r) => w.classes.find((c) => c.id === r.classId)?.name).join(" & ");
        issues.push({ kind: "room", message: `Period ${p.number}: ${names} are both in room ${room.toUpperCase()}.`, cells: rs.map((r) => key(p.id, r.classId)) });
      }
    }
  }
  for (const c of w.classes) {
    const seen = new Map<number, RotationRow[]>();
    for (const r of w.rotations.filter((x) => x.classId === c.id)) seen.set(r.subjectId, [...(seen.get(r.subjectId) ?? []), r]);
    for (const [subjectId, rs] of seen) {
      if (rs.length > 1) {
        const s = w.subjects.find((x) => x.id === subjectId);
        issues.push({ kind: "repeat", message: `${c.name} has ${s?.name ?? "a subject"} more than once.`, cells: rs.map((r) => key(r.periodId, r.classId)) });
      }
    }
  }
  return issues;
}

export interface GeneratedCell {
  classId: number;
  periodId: number;
  subjectId: number;
  room: string;
}

/**
 * Latin-square timetable: class c in period p does subject (c + p) mod S.
 * Every class meets every subject once (while periods ≤ subjects) and no
 * subject is double-booked beyond ceil(classes / subjects) classes per period,
 * each given its own room from the subject's room pool.
 */
export function generateTimetable(classes: ClassRow[], periods: PeriodRow[], subjects: SubjectRow[]): GeneratedCell[] {
  const cs = [...classes].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
  const ps = [...periods].sort((a, b) => a.number - b.number);
  const ss = subjects.filter((s) => s.active).sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
  if (!ss.length) return [];
  const cells: GeneratedCell[] = [];
  cs.forEach((c, ci) => {
    ps.forEach((p, pi) => {
      const s = ss[(ci + pi) % ss.length];
      const station = Math.floor(ci / ss.length);
      const room = s.rooms.length ? s.rooms[station % s.rooms.length] : "";
      cells.push({ classId: c.id, periodId: p.id, subjectId: s.id, room });
    });
  });
  return cells;
}
