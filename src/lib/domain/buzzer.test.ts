import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ClassRow, EventRow, PeriodRow, RotationRow, SubjectRow, World } from "@/lib/types";
import { buzzerStatusForClass, currentBuzzerSlot } from "./buzzer";

describe("Buzzer round: eligibility", () => {
  const period = (n: number): PeriodRow => ({ id: n, number: n, startsAt: new Date(0), endsAt: new Date(0) });
  const klass: ClassRow = { id: 1, name: "2-B", color: "#000", sortOrder: 0, teamPhotoUrl: null };
  const social: SubjectRow = {
    id: 1, name: "SOCIAL STUDIES", tagline: "", description: "", activity: "", icon: "🌏", color: "#000", maxScore: 20, rooms: [], sortOrder: 0, active: true,
    isMathsChallenge: false, isBuzzerChallenge: true,
  };
  const history: SubjectRow = { ...social, id: 2, name: "HISTORY", isBuzzerChallenge: false };
  const rotation = (periodId: number, subjectId: number): RotationRow => ({ id: periodId, periodId, classId: klass.id, subjectId, room: "" });

  function world(overrides: Partial<EventRow>, rotations: RotationRow[]): World {
    const event: EventRow = {
      id: 1, name: "", tagline: "", eventDate: "2026-10-02", timezone: "Pacific/Auckland", venue: "", assemblyPoint: "",
      phase: "school_day", phaseChangedAt: new Date(), scoringLocked: false, leaderboardMode: "exact", timetableMode: "manual",
      currentPeriod: 1, notesRequired: 3, principalRoom: "", detentionRoom: "", detentionInstructions: "", ...overrides,
    };
    return {
      event, classes: [klass], students: [], subjects: [social, history], periods: [period(1), period(2)], rotations,
      scores: [], boundaries: [], clubs: [], completions: [], notes: [], attempts: [], mods: [], detentions: [], tiers: [],
    };
  }

  it("finds the slot when the class is, right now, in the Buzzer-flagged subject", () => {
    const w = world({ currentPeriod: 1 }, [rotation(1, social.id), rotation(2, history.id)]);
    const slot = currentBuzzerSlot(w, klass.id);
    assert.deepEqual(slot && { periodId: slot.periodId, subject: slot.subject.name }, { periodId: 1, subject: "SOCIAL STUDIES" });
  });

  it("finds nothing when the class is in a different subject right now", () => {
    const w = world({ currentPeriod: 1 }, [rotation(1, history.id), rotation(2, social.id)]);
    assert.equal(currentBuzzerSlot(w, klass.id), null);
    assert.equal(buzzerStatusForClass(w, klass.id), "upcoming");
  });

  it("finds nothing once the class's Social Studies period has passed", () => {
    const w = world({ currentPeriod: 2 }, [rotation(1, social.id), rotation(2, history.id)]);
    assert.equal(currentBuzzerSlot(w, klass.id), null);
    assert.equal(buzzerStatusForClass(w, klass.id), "complete");
  });

  it("only ever runs during School Day", () => {
    const w = world({ phase: "after_school", currentPeriod: 1 }, [rotation(1, social.id)]);
    assert.equal(currentBuzzerSlot(w, klass.id), null);
    assert.equal(buzzerStatusForClass(w, klass.id), "not_school_day");
  });

  it("a student with no class yet is never eligible", () => {
    const w = world({ currentPeriod: 1 }, [rotation(1, social.id)]);
    assert.equal(currentBuzzerSlot(w, null), null);
    assert.equal(buzzerStatusForClass(w, null), "no_class");
  });

  it("no subject flagged as the Buzzer round: never eligible, never crashes", () => {
    const plainHistory: SubjectRow = { ...history, id: 3 };
    const w: World = { ...world({ currentPeriod: 1 }, [rotation(1, plainHistory.id)]), subjects: [plainHistory] };
    assert.equal(currentBuzzerSlot(w, klass.id), null);
    assert.equal(buzzerStatusForClass(w, klass.id), "no_buzzer");
  });

  it("Maths and Buzzer are independent: a class in Maths isn't eligible for Buzzer, and vice versa", () => {
    const maths: SubjectRow = { ...social, id: 4, name: "MATHS", isMathsChallenge: true, isBuzzerChallenge: false };
    const w: World = { ...world({ currentPeriod: 1 }, [rotation(1, maths.id)]), subjects: [maths, social] };
    assert.equal(currentBuzzerSlot(w, klass.id), null, "in Maths right now, not Buzzer");
  });
});
