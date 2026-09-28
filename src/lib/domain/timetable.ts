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

const pairKey = (a: number, b: number) => (a < b ? `${a}:${b}` : `${b}:${a}`);

/**
 * How many periods each pair of classes spends doing the same subject together, summed over every
 * pair and counting only the excess past their first time together (so a pair that's never together
 * twice contributes nothing).
 */
function repeatedPairings(subjectAt: number[][]): number {
  const periodCount = subjectAt[0]?.length ?? 0;
  const coCount = new Map<string, number>();
  for (let pi = 0; pi < periodCount; pi++) {
    const byGroup = new Map<number, number[]>();
    for (let ci = 0; ci < subjectAt.length; ci++) byGroup.set(subjectAt[ci][pi], [...(byGroup.get(subjectAt[ci][pi]) ?? []), ci]);
    for (const group of byGroup.values()) {
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          const key = pairKey(group[i], group[j]);
          coCount.set(key, (coCount.get(key) ?? 0) + 1);
        }
      }
    }
  }
  let repeats = 0;
  for (const n of coCount.values()) repeats += n - 1;
  return repeats;
}

/** A small, seeded PRNG (mulberry32) so the "best of several tries" search below is deterministic —
 * the same classes/periods/subjects always regenerate the same timetable. */
function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher–Yates, using the given RNG. */
function shuffled<T>(items: T[], rng: () => number): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * The classic Latin square (class c does subject (c + p) mod S at period p) guarantees every class
 * meets every subject exactly once, but two classes with the same `classIndex mod S` are locked into
 * doing every subject together, at the same time, all day — the "same class [subject] together" the
 * generator is meant to avoid, and a fixed formula like this has no freedom left to fix it: any class's
 * subject sequence has to contain every subject exactly once, which pins down the whole row.
 *
 * So instead: split classes into "families" of up to S (one class per residue mod S), give each family
 * its own shuffled subject order rather than the same one shifted, and try several different shuffles,
 * keeping whichever spreads pairings out the most. Two classes from different families now only land on
 * the same subject at the same time when their two families' shuffles happen to agree at that spot —
 * not for the whole day, as a shared shift would guarantee. A final pass of "intercalate" swaps (trade
 * two classes' subjects at two periods when each already has the other's subject there, which can never
 * create a duplicate) squeezes out a bit more.
 */
function optimiseSubjectGrid(classCount: number, periodCount: number, subjectCount: number): number[][] {
  const families = Math.ceil(classCount / subjectCount) || 1;
  const buildWith = (rng: () => number): number[][] => {
    const perms = Array.from({ length: families }, () => shuffled(Array.from({ length: subjectCount }, (_, i) => i), rng));
    return Array.from({ length: classCount }, (_, ci) => {
      const family = Math.floor(ci / subjectCount);
      const withinFamily = ci % subjectCount;
      return Array.from({ length: periodCount }, (_, pi) => perms[family][(withinFamily + pi) % subjectCount]);
    });
  };

  let best = buildWith(mulberry32(1));
  let bestCost = repeatedPairings(best);
  const tries = Math.min(80, classCount * periodCount + 20); // more room to search on bigger timetables, capped for speed
  for (let seed = 2; seed <= tries && bestCost > 0; seed++) {
    const candidate = buildWith(mulberry32(seed));
    const cost = repeatedPairings(candidate);
    if (cost < bestCost) {
      best = candidate;
      bestCost = cost;
    }
  }

  for (let pass = 0; pass < 8 && bestCost > 0; pass++) {
    let improved = false;
    for (let c1 = 0; c1 < periodCount; c1++) {
      for (let c2 = c1 + 1; c2 < periodCount; c2++) {
        for (let a = 0; a < classCount; a++) {
          for (let b = a + 1; b < classCount; b++) {
            const x = best[a][c1];
            const y = best[a][c2];
            if (x === y || best[b][c1] !== y || best[b][c2] !== x) continue; // not a valid intercalate
            best[a][c1] = y;
            best[a][c2] = x;
            best[b][c1] = x;
            best[b][c2] = y;
            const newCost = repeatedPairings(best);
            if (newCost < bestCost) {
              bestCost = newCost;
              improved = true;
            } else {
              best[a][c1] = x;
              best[a][c2] = y;
              best[b][c1] = y;
              best[b][c2] = x;
            }
          }
        }
      }
    }
    if (!improved) break;
  }
  return best;
}

/**
 * Splits a group of classes sharing one subject-period into that subject's rooms, one class per room
 * when there are enough rooms to go round. When there aren't, `seenPairs` — every pair of classes
 * already put in a room together earlier in this same generation run — steers each class into whichever
 * room currently has the fewest classmates it's already shared a room with, so a room shortage spreads
 * across different classes instead of repeatedly pairing up the same two. Updates `seenPairs` in place
 * with whatever pairings this period's assignment creates.
 */
function assignRooms(group: ClassRow[], rooms: string[], seenPairs: Set<string>): Map<number, string> {
  const assignment = new Map<number, string>();
  if (!rooms.length) {
    for (const c of group) assignment.set(c.id, "");
    return assignment;
  }
  const buckets: ClassRow[][] = rooms.map(() => []);
  for (const c of group) {
    let best = 0;
    let bestScore = Infinity;
    buckets.forEach((bucket, i) => {
      const conflicts = bucket.filter((other) => seenPairs.has(pairKey(c.id, other.id))).length;
      const score = conflicts * 1000 + bucket.length; // avoiding a repeat pairing matters far more than balancing bucket sizes
      if (score < bestScore) {
        bestScore = score;
        best = i;
      }
    });
    buckets[best].push(c);
    assignment.set(c.id, rooms[best]);
  }
  for (const bucket of buckets) {
    for (let i = 0; i < bucket.length; i++) {
      for (let j = i + 1; j < bucket.length; j++) seenPairs.add(pairKey(bucket[i].id, bucket[j].id));
    }
  }
  return assignment;
}

/**
 * Every class meets every subject exactly once (while periods ≤ subjects). Which classes end up doing
 * a subject together, period by period, is chosen to minimise how often the same two classes share a
 * subject more than once across the day — and within a shared subject, which room each is in does the
 * same for room-sharing, on the rare occasion a subject's own room pool is too small to seat its whole
 * group at once.
 */
export function generateTimetable(classes: ClassRow[], periods: PeriodRow[], subjects: SubjectRow[]): GeneratedCell[] {
  const cs = [...classes].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
  const ps = [...periods].sort((a, b) => a.number - b.number);
  const ss = subjects.filter((s) => s.active).sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
  if (!ss.length) return [];
  const subjectAt = optimiseSubjectGrid(cs.length, ps.length, ss.length);
  const cells: GeneratedCell[] = [];
  const seenPairs = new Set<string>();
  ps.forEach((p, pi) => {
    const groups = new Map<number, ClassRow[]>(); // subject index -> classes doing it this period
    cs.forEach((c, ci) => {
      const si = subjectAt[ci][pi];
      groups.set(si, [...(groups.get(si) ?? []), c]);
    });
    for (const [si, group] of groups) {
      const s = ss[si];
      const assignment = assignRooms(group, s.rooms, seenPairs);
      for (const c of group) cells.push({ classId: c.id, periodId: p.id, subjectId: s.id, room: assignment.get(c.id) ?? "" });
    }
  });
  return cells;
}
