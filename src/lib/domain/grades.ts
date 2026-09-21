import type { BoundaryRow, ClassRow, ModificationRow, ScoreRow, SubjectRow, World } from "@/lib/types";

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
export const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Highest boundary whose minimum the percentage reaches. Boundaries need not be sorted. */
export function letterFor(pct: number | null, boundaries: readonly BoundaryRow[]): string {
  if (pct === null) return "—";
  const p = round2(pct); // the 2dp value is what's displayed, so it decides the grade
  const sorted = [...boundaries].sort((a, b) => b.minPercent - a.minPercent);
  for (const b of sorted) if (p >= b.minPercent) return b.grade;
  return sorted.at(-1)?.grade ?? "—";
}

/** Boundaries as displayable ranges, e.g. B+ 75–79.99. */
export function boundaryRanges(boundaries: readonly BoundaryRow[]) {
  const sorted = [...boundaries].sort((a, b) => b.minPercent - a.minPercent);
  return sorted.map((b, i) => ({
    grade: b.grade,
    min: b.minPercent,
    max: i === 0 ? 100 : round2(sorted[i - 1].minPercent - 0.01),
  }));
}

/** Problems that would make grading unreliable. Empty array = valid. */
export function validateBoundaries(rows: readonly { grade: string; minPercent: number }[]): string[] {
  const errors: string[] = [];
  if (rows.length === 0) errors.push("Add at least one grade.");
  if (rows.length && !rows.some((r) => r.minPercent === 0)) errors.push("One grade must start at 0% so every class gets a grade.");
  const grades = new Set<string>();
  const mins = new Set<number>();
  for (const r of rows) {
    if (!r.grade.trim()) errors.push("Every grade needs a letter.");
    if (grades.has(r.grade.trim().toLowerCase())) errors.push(`Grade "${r.grade}" appears twice.`);
    if (mins.has(r.minPercent)) errors.push(`Two grades start at ${r.minPercent}%.`);
    if (r.minPercent < 0 || r.minPercent > 100) errors.push(`${r.grade}: start must be between 0 and 100.`);
    grades.add(r.grade.trim().toLowerCase());
    mins.add(r.minPercent);
  }
  return errors;
}

export interface SubjectResult {
  subject: SubjectRow;
  score: number | null;
  max: number;
}

export interface ClassResult {
  klass: ClassRow;
  subjects: SubjectResult[];
  scoredCount: number;
  subjectCount: number;
  /** Sum of marks / sum of maximums, over subjects marked so far. */
  raw: number;
  max: number;
  originalPct: number | null;
  originalGrade: string;
  modDelta: number;
  currentPct: number | null;
  currentGrade: string;
  /** currentPct − originalPct, in percentage points. */
  change: number;
  rank: number;
}

export function computeClassResult(
  klass: ClassRow,
  subjects: readonly SubjectRow[],
  scores: readonly ScoreRow[],
  mods: readonly ModificationRow[],
  boundaries: readonly BoundaryRow[],
): Omit<ClassResult, "rank"> {
  const active = subjects.filter((s) => s.active);
  const rows: SubjectResult[] = active.map((subject) => {
    const s = scores.find((x) => x.classId === klass.id && x.subjectId === subject.id);
    return { subject, score: s ? s.score : null, max: subject.maxScore };
  });
  const scored = rows.filter((r) => r.score !== null);
  const raw = scored.reduce((a, r) => a + (r.score ?? 0), 0);
  const max = scored.reduce((a, r) => a + r.max, 0);
  const originalPct = max > 0 ? round2((raw / max) * 100) : null;
  const modDelta = mods.filter((m) => m.classId === klass.id && !m.revokedAt).reduce((a, m) => a + m.deltaPercent, 0);
  const currentPct = originalPct === null && modDelta === 0 ? null : round2(clamp((originalPct ?? 0) + modDelta, 0, 100));
  return {
    klass,
    subjects: rows,
    scoredCount: scored.length,
    subjectCount: rows.length,
    raw,
    max,
    originalPct,
    originalGrade: letterFor(originalPct, boundaries),
    modDelta: round2(modDelta),
    currentPct,
    currentGrade: letterFor(currentPct, boundaries),
    change: round2((currentPct ?? 0) - (originalPct ?? 0)),
  };
}

/** Standard competition ranking: ties share a rank (1, 1, 3). Unmarked classes rank last. */
export function rankResults<T extends { currentPct: number | null; klass: ClassRow }>(rows: T[]): (T & { rank: number })[] {
  const sorted = [...rows].sort(
    (a, b) => (b.currentPct ?? -1) - (a.currentPct ?? -1) || a.klass.sortOrder - b.klass.sortOrder || a.klass.name.localeCompare(b.klass.name),
  );
  let prev: number | null | undefined;
  let rank = 0;
  return sorted.map((r, i) => {
    if (i === 0 || r.currentPct !== prev) rank = i + 1;
    prev = r.currentPct;
    return { ...r, rank };
  });
}

/** Every class's result, ranked by current percentage. */
export function computeStandings(w: World): ClassResult[] {
  const results = w.classes.map((k) => computeClassResult(k, w.subjects, w.scores, w.mods, w.boundaries));
  return rankResults(results);
}

/** 78.75 → "78.75%", 87.5 → "87.5%", 84 → "84.0%". */
export function formatPct(pct: number | null): string {
  if (pct === null) return "—";
  let s = round2(pct).toFixed(2);
  if (s.endsWith("0")) s = s.slice(0, -1);
  return `${s}%`;
}

/** A class only has a grade once at least one subject has been marked. Never show a placeholder grade before that. */
export const hasGrade = (r: { scoredCount: number }) => r.scoredCount > 0;

export const formatDelta = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : "±"}${Math.abs(round2(n))}%`;
