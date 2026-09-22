import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { BoundaryRow, ClassRow, ModificationRow, ScoreRow, SubjectRow } from "@/lib/types";
import { computeClassResult, formatPct, letterFor, rankResults, validateBoundaries } from "./grades";
import { generateTimetable } from "./timetable";
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
  const subjects = [1, 2, 3, 4].map((i) => subject(i, [`R${i}a`, `R${i}b`]));
  const cells = generateTimetable(classes, periods, subjects);

  it("fills every class × period", () => assert.equal(cells.length, 32));
  it("gives every class each subject exactly once", () => {
    for (const c of classes) {
      const ids = cells.filter((x) => x.classId === c.id).map((x) => x.subjectId).sort();
      assert.deepEqual(ids, [1, 2, 3, 4]);
    }
  });
  it("never double-books a room in the same period", () => {
    for (const p of periods) {
      const rooms = cells.filter((x) => x.periodId === p.id).map((x) => x.room);
      assert.equal(new Set(rooms).size, rooms.length);
    }
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
