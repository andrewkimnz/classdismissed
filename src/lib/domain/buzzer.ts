import type { World } from "@/lib/types";
import { currentSubjectSlot, subjectStatusForClass, type SubjectSlot } from "./timetable";

export type BuzzerSlot = SubjectSlot;

/** Is this class, right now, in the subject that runs the Buzzer round? */
export function currentBuzzerSlot(w: World, classId: number | null): BuzzerSlot | null {
  return currentSubjectSlot(w, classId, (s) => s.isBuzzerChallenge);
}

/** Why a class can't play right now, for a friendly message (not shown when `currentBuzzerSlot` finds a slot). */
export function buzzerStatusForClass(w: World, classId: number | null): "not_school_day" | "no_class" | "upcoming" | "complete" | "no_buzzer" {
  const status = subjectStatusForClass(w, classId, (s) => s.isBuzzerChallenge);
  return status === "not_scheduled" ? "no_buzzer" : status;
}
