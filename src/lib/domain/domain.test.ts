import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { BoundaryRow, ClassRow, EventRow, ModificationRow, PeriodRow, RotationRow, ScoreRow, SubjectRow, World } from "@/lib/types";
import { computeClassResult, formatPct, letterFor, rankResults, validateBoundaries } from "./grades";
import { generateTimetable, timetableIssues } from "./timetable";
import { toHHMM, zonedToUtc } from "./time";
import { codeFromScan } from "@/lib/auth/scan";

const boundaries: BoundaryRow[] = [
  ["A+", 90], ["A", 85], ["A-", 80], ["B+", 75], ["B", 70], ["B-", 65], ["C+", 60], ["C", 55], ["C-", 50], ["D", 40], ["F", 0],
].map(([grade, minPercent], id) => ({ id, grade: grade as string, minPercent: minPercent as number }));

const klass = (id: number, name: string): ClassRow => ({ id, name, color: "#000", sortOrder: id, teamPhotoUrl: null });
const subject = (id: number, rooms: string[] = []): SubjectRow => ({
  id, name: `S${id}`, tagline: "", description: "", activity: "", icon: "", color: "#000", maxScore: 20, rooms, sortOrder: id, active: true, isMathsChallenge: false, isBuzzerChallenge: false,
});

describe("grade boundaries", () => {
  it("maps percentages to letters", () => {
    assert.equal(letterFor(78.75, boundaries), "B+");
    assert.equal(letterFor(90, boundaries), "A+");
    assert.equal(letterFor(89.99, boundaries), "A");
    assert.equal(letterFor(0, boundaries), "F");
    assert.equal(letterFor(null, boundaries), "—");
  });
  it("grades the displayed (2dp) value, so 79.996 shows 80% and A-", () => {
    assert.equal(letterFor(79.996, boundaries), "A-");
  });
  it("is unaffected by boundary row order", () => {
    assert.equal(letterFor(66, [...boundaries].reverse()), "B-");
  });
  it("flags unusable boundary sets", () => {
    assert.ok(validateBoundaries([{ grade: "A", minPercent: 50 }]).some((e) => e.includes("0%")));
    assert.ok(validateBoundaries([{ grade: "A", minPercent: 0 }, { grade: "a", minPercent: 50 }]).some((e) => e.includes("twice")));
    assert.deepEqual(validateBoundaries([{ grade: "A", minPercent: 50 }, { grade: "F", minPercent: 0 }]), []);
  });
  it("formats percentages the way the brief shows them", () => {
    assert.equal(formatPct(78.75), "78.75%");
    assert.equal(formatPct(87.5), "87.5%");
    assert.equal(formatPct(84), "84.0%");
  });
});

describe("class results", () => {
  const subjects = [1, 2, 3, 4].map((i) => subject(i));
  const k = klass(1, "2-B");
  const scores: ScoreRow[] = [16, 14, 18, 15].map((score, i) => ({ id: i, classId: 1, subjectId: i + 1, score, updatedAt: new Date() }));
  const mod = (over: Partial<ModificationRow>): ModificationRow => ({
    id: 1, classId: 1, attemptId: null, kind: "principal_attempt", deltaPercent: 5, reason: "", createdAt: new Date(), revokedAt: null, revokeReason: null, ...over,
  });

  it("matches the brief: 63/80 = 78.75% = B+", () => {
    const r = computeClassResult(k, subjects, scores, [], boundaries);
    assert.equal(r.raw, 63);
    assert.equal(r.max, 80);
    assert.equal(r.originalPct, 78.75);
    assert.equal(r.originalGrade, "B+");
    assert.equal(r.currentPct, 78.75);
  });
  it("keeps the original result and layers modifications on top (+5% → 83.75% A-)", () => {
    const r = computeClassResult(k, subjects, scores, [mod({})], boundaries);
    assert.equal(r.originalGrade, "B+");
    assert.equal(r.currentPct, 83.75);
    assert.equal(r.currentGrade, "A-");
    assert.equal(r.change, 5);
  });
  it("ignores revoked modifications and other classes' modifications", () => {
    const r = computeClassResult(k, subjects, scores, [mod({ revokedAt: new Date() }), mod({ classId: 9 })], boundaries);
    assert.equal(r.currentPct, 78.75);
  });
  it("clamps to 0–100", () => {
    assert.equal(computeClassResult(k, subjects, scores, [mod({ deltaPercent: 50 })], boundaries).currentPct, 100);
    assert.equal(computeClassResult(k, subjects, scores, [mod({ deltaPercent: -500 })], boundaries).currentPct, 0);
  });
  it("scores over the subjects marked so far (fair mid-event standings)", () => {
    const r = computeClassResult(k, subjects, scores.slice(0, 2), [], boundaries);
    assert.equal(r.scoredCount, 2);
    assert.equal(r.originalPct, 75);
  });
  it("has no percentage before anything is marked", () => {
    const r = computeClassResult(k, subjects, [], [], boundaries);
    assert.equal(r.originalPct, null);
    assert.equal(r.currentGrade, "—");
  });
  it("ranks with ties sharing a place, unmarked classes last", () => {
    const mk = (id: number, pct: number | null) => ({ klass: klass(id, `C${id}`), currentPct: pct });
    const ranked = rankResults([mk(1, 80), mk(2, 90), mk(3, 80), mk(4, null)]);
    assert.deepEqual(ranked.map((r) => [r.klass.id, r.rank]), [[2, 1], [1, 2], [3, 2], [4, 4]]);
  });
});

describe("timetable generator", () => {
  const classes = Array.from({ length: 8 }, (_, i) => klass(i + 1, `C${i + 1}`));
  const periods = [1, 2, 3, 4].map((n) => ({ id: n, number: n, startsAt: new Date(), endsAt: new Date() }));
  const subjects = [1, 2, 3, 4].map((i) => subject(i, [`R${i}`]));
  const cells = generateTimetable(classes, periods, subjects);

  it("fills every class × period", () => assert.equal(cells.length, 32));
  it("gives every class each subject exactly once", () => {
    for (const c of classes) {
      const ids = cells.filter((x) => x.classId === c.id).map((x) => x.subjectId).sort();
      assert.deepEqual(ids, [1, 2, 3, 4]);
    }
  });
  it("every class doing a subject is in that subject's one room — the same room every time", () => {
    for (const s of subjects) {
      const rooms = cells.filter((x) => x.subjectId === s.id).map((x) => x.room);
      assert.ok(rooms.every((r) => r === s.rooms[0]));
    }
  });
  it("never puts two different subjects in the same room at the same period", () => {
    for (const p of periods) {
      const byRoom = new Map<string, Set<number>>();
      for (const cell of cells.filter((x) => x.periodId === p.id)) {
        byRoom.set(cell.room, (byRoom.get(cell.room) ?? new Set()).add(cell.subjectId));
      }
      for (const subjectIds of byRoom.values()) assert.equal(subjectIds.size, 1);
    }
  });
});

describe("timetableIssues: a shared room is only a clash between different subjects", () => {
  const period: PeriodRow = { id: 1, number: 1, startsAt: new Date(0), endsAt: new Date(0) };
  const geography = subject(1, ["201-318"]);
  const history = subject(2, ["201-315"]);
  const a = klass(1, "1-A");
  const b = klass(2, "1-B");
  const rotation = (over: Partial<RotationRow>): RotationRow => ({ id: over.classId ?? 0, periodId: period.id, classId: 0, subjectId: geography.id, room: geography.rooms[0], ...over });

  function world(rotations: RotationRow[], subjects: SubjectRow[]): World {
    const event: EventRow = {
      id: 1, name: "", tagline: "", eventDate: "2026-10-02", timezone: "Pacific/Auckland", venue: "", assemblyPoint: "",
      phase: "school_day", phaseChangedAt: new Date(), scoringLocked: false, leaderboardMode: "exact", timetableMode: "manual",
      currentPeriod: 1, notesRequired: 3, principalRoom: "", detentionRoom: "", detentionInstructions: "",
    };
    return {
      event, classes: [a, b], students: [], subjects, periods: [period], rotations,
      scores: [], boundaries: [], clubs: [], completions: [], notes: [], attempts: [], mods: [], detentions: [], tiers: [],
    };
  }

  it("two classes doing the SAME subject in its one room is not a clash", () => {
    const w = world([rotation({ classId: a.id, subjectId: geography.id, room: "201-318" }), rotation({ classId: b.id, subjectId: geography.id, room: "201-318" })], [geography, history]);
    assert.deepEqual(timetableIssues(w).filter((i) => i.kind === "room"), []);
  });

  it("two DIFFERENT subjects landing in the same room at the same period is a real clash", () => {
    const w = world([rotation({ classId: a.id, subjectId: geography.id, room: "201-318" }), rotation({ classId: b.id, subjectId: history.id, room: "201-318" })], [geography, history]);
    const issues = timetableIssues(w).filter((i) => i.kind === "room");
    assert.equal(issues.length, 1);
    assert.match(issues[0].message, /both in room 201-318, but doing different subjects/);
  });
});

describe("timetable generator: minimises two classes doing the same subject together more than once", () => {
  // 8 classes but only 4 subjects, so 2 classes share each subject each period. A plain "class c does
  // subject (c + p) mod S" formula pins classes 1&5, 2&6, 3&7 and 4&8 together for the WHOLE day — same
  // subject, same period, every single period, because that pairing falls out of the formula itself, not
  // chance. The generator should spread who's grouped with whom instead of locking in one fixed pairing.
  const classes = Array.from({ length: 8 }, (_, i) => klass(i + 1, `C${i + 1}`));
  const periods = [1, 2, 3, 4].map((n) => ({ id: n, number: n, startsAt: new Date(), endsAt: new Date() }));
  const subjects = [1, 2, 3, 4].map((i) => subject(i));
  const cells = generateTimetable(classes, periods, subjects);

  it("still gives every class each subject exactly once", () => {
    for (const c of classes) {
      const ids = cells.filter((x) => x.classId === c.id).map((x) => x.subjectId).sort();
      assert.deepEqual(ids, [1, 2, 3, 4]);
    }
  });

  it("no pair of classes does every subject together — the fixed-formula pairing is gone", () => {
    const counts = new Map<string, number>();
    for (const p of periods) {
      const bySubject = new Map<number, number[]>();
      for (const cell of cells.filter((x) => x.periodId === p.id)) bySubject.set(cell.subjectId, [...(bySubject.get(cell.subjectId) ?? []), cell.classId]);
      for (const ids of bySubject.values()) {
        for (let i = 0; i < ids.length; i++) {
          for (let j = i + 1; j < ids.length; j++) {
            const key = [ids[i], ids[j]].sort((a, b) => a - b).join(":");
            counts.set(key, (counts.get(key) ?? 0) + 1);
          }
        }
      }
    }
    for (const [pair, n] of counts) assert.ok(n < periods.length, `${pair} shared a subject in all ${periods.length} periods`);
  });
});

describe("event timezone", () => {
  it("6:30 PM on 2 Oct 2026 in Auckland (NZDT, UTC+13) is 05:30Z", () => {
    assert.equal(zonedToUtc("2026-10-02", "18:30", "Pacific/Auckland").toISOString(), "2026-10-02T05:30:00.000Z");
  });
  it("round-trips through HH:MM", () => {
    assert.equal(toHHMM(zonedToUtc("2026-10-02", "19:05", "Pacific/Auckland"), "Pacific/Auckland"), "19:05");
  });
});

describe("QR login scan parsing", () => {
  it("takes the code from a card link, ignoring the host", () => {
    assert.equal(codeFromScan("https://kac-academy.vercel.app/l/KIM042"), "KIM042");
    assert.equal(codeFromScan("http://192.168.1.20:3000/l/ab3-x7k"), "AB3X7K");
    assert.equal(codeFromScan("  https://x.test/l/KIM042?utm=1  "), "KIM042");
  });
  it("accepts a bare code, with or without the dash", () => {
    assert.equal(codeFromScan("KIM-042"), "KIM042");
    assert.equal(codeFromScan("kim042"), "KIM042");
  });
  it("rejects anything that isn't a card: other links, junk, empty, and over-long input", () => {
    for (const bad of ["https://evil.example/login", "https://evil.example/", "hello world", "", "   ", "WIFI:S:x;T:WPA;P:y;;", "https://x.test/l/", "https://x.test/l/AB", "A".repeat(40)]) {
      assert.equal(codeFromScan(bad), null, `should reject ${JSON.stringify(bad)}`);
    }
  });
  it("never returns anything but letters and digits (safe to put in a URL path)", () => {
    for (const t of ["https://x.test/l/KIM042", "KIM-042", "ab3-x7k"]) assert.match(codeFromScan(t) ?? "", /^[A-Z0-9]+$/);
    assert.equal(codeFromScan("https://x.test/l/KIM042/../../admin"), "KIM042", "path tricks after the code are ignored, only the code is used");
  });
});
