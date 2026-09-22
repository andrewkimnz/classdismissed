import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ClassRow, EventRow, PeriodRow, RotationRow, SubjectRow, World } from "@/lib/types";
import { currentMathsSlot, generateMathQuestion, mathStatusForClass } from "./math";

// A tiny, seeded PRNG so the fuzz test is deterministic and reproducible on failure.
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Ground truth: parses the question's own display text and evaluates it with normal JS (and therefore
 * normal) operator precedence, completely independently of generateMathQuestion's internal logic. */
function reevaluate(text: string): number {
  const js = text.replaceAll("×", "*").replaceAll("÷", "/").replaceAll("−", "-");
  if (!/^-?\d+(\.\d+)?\s*[-+*/]\s*-?\d+(\.\d+)?\s*[-+*/]\s*-?\d+(\.\d+)?$/.test(js)) throw new Error(`unexpected shape: ${text}`);
  // eslint-disable-next-line no-new-func
  return Function(`"use strict"; return (${js});`)();
}

describe("Maths toss challenge: question generator", () => {
  it("every generated question has a whole, non-negative answer that matches how it reads (2000 samples, seeded)", () => {
    const rand = mulberry32(20261002);
    for (let i = 0; i < 2000; i++) {
      const q = generateMathQuestion(rand);
      assert.match(q.text, /^\d{1,2} [+−×÷] \d{1,2} [+−×÷] \d{1,2}$/, `text: "${q.text}"`);
      assert.ok(Number.isInteger(q.answer) && q.answer >= 0, `answer ${q.answer} for "${q.text}"`);
      assert.equal(reevaluate(q.text), q.answer, `"${q.text}" should evaluate to ${q.answer}`);
    }
  });

  it("respects standard order of operations (× and ÷ before + and −), not left-to-right", () => {
    // "2 + 6 × 3" must be 2 + 18 = 20, not (2 + 6) × 3 = 24.
    assert.equal(reevaluate("2 + 6 × 3"), 20);
    // "12 ÷ 3 × 2" (same precedence) must go left to right: (12 ÷ 3) × 2 = 8, not 12 ÷ (3 × 2) = 2.
    assert.equal(reevaluate("12 ÷ 3 × 2"), 8);
  });

  it("never divides by zero or produces a fraction (operands are 1–12, so this mostly guards the generator itself)", () => {
    const rand = mulberry32(1);
    for (let i = 0; i < 500; i++) assert.ok(Number.isInteger(generateMathQuestion(rand).answer));
  });
});

describe("Maths toss challenge: eligibility", () => {
  const period = (n: number): PeriodRow => ({ id: n, number: n, startsAt: new Date(0), endsAt: new Date(0) });
  const klass: ClassRow = { id: 1, name: "2-B", color: "#000", sortOrder: 0, teamPhotoUrl: null };
  const maths: SubjectRow = {
    id: 1, name: "MATHS", tagline: "", description: "", activity: "", icon: "➗", color: "#000", maxScore: 20, rooms: [], sortOrder: 0, active: true, isMathsChallenge: true, isBuzzerChallenge: false,
  };
  const history: SubjectRow = { ...maths, id: 2, name: "HISTORY", isMathsChallenge: false };
  const rotation = (periodId: number, subjectId: number): RotationRow => ({ id: periodId, periodId, classId: klass.id, subjectId, room: "" });

  function world(overrides: Partial<EventRow>, rotations: RotationRow[]): World {
    const event: EventRow = {
      id: 1, name: "", tagline: "", eventDate: "2026-10-02", timezone: "Pacific/Auckland", venue: "", assemblyPoint: "",
      phase: "school_day", phaseChangedAt: new Date(), scoringLocked: false, leaderboardMode: "exact", timetableMode: "manual",
      currentPeriod: 1, notesRequired: 3, principalRoom: "", detentionRoom: "", detentionInstructions: "", ...overrides,
    };
    return {
      event, classes: [klass], students: [], subjects: [maths, history], periods: [period(1), period(2)], rotations,
      scores: [], boundaries: [], clubs: [], completions: [], notes: [], attempts: [], mods: [], detentions: [], tiers: [],
    };
  }

  it("finds the slot when the class is, right now, in the Maths-flagged subject", () => {
    const w = world({ currentPeriod: 1 }, [rotation(1, maths.id), rotation(2, history.id)]);
    const slot = currentMathsSlot(w, klass.id);
    assert.deepEqual(slot && { periodId: slot.periodId, subject: slot.subject.name }, { periodId: 1, subject: "MATHS" });
  });

  it("finds nothing when the class is in a different subject right now", () => {
    const w = world({ currentPeriod: 1 }, [rotation(1, history.id), rotation(2, maths.id)]);
    assert.equal(currentMathsSlot(w, klass.id), null);
    assert.equal(mathStatusForClass(w, klass.id), "upcoming"); // Maths hasn't happened yet
  });

  it("finds nothing once the class's Maths period has passed", () => {
    const w = world({ currentPeriod: 2 }, [rotation(1, maths.id), rotation(2, history.id)]);
    assert.equal(currentMathsSlot(w, klass.id), null);
    assert.equal(mathStatusForClass(w, klass.id), "complete");
  });

  it("only ever runs during School Day", () => {
    const w = world({ phase: "after_school", currentPeriod: 1 }, [rotation(1, maths.id)]);
    assert.equal(currentMathsSlot(w, klass.id), null);
    assert.equal(mathStatusForClass(w, klass.id), "not_school_day");
  });

  it("a student with no class yet is never eligible", () => {
    const w = world({ currentPeriod: 1 }, [rotation(1, maths.id)]);
    assert.equal(currentMathsSlot(w, null), null);
    assert.equal(mathStatusForClass(w, null), "no_class");
  });

  it("no subject flagged as the Maths challenge: never eligible, never crashes", () => {
    const plainHistory: SubjectRow = { ...history, id: 3 };
    const w: World = { ...world({ currentPeriod: 1 }, [rotation(1, plainHistory.id)]), subjects: [plainHistory] };
    assert.equal(currentMathsSlot(w, klass.id), null);
    assert.equal(mathStatusForClass(w, klass.id), "no_maths");
  });
});
