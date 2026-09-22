import type { World } from "@/lib/types";
import { currentSubjectSlot, subjectStatusForClass, type SubjectSlot } from "./timetable";

export type MathSlot = SubjectSlot;

/** Is this class, right now, in the subject that runs the Maths toss challenge? */
export function currentMathsSlot(w: World, classId: number | null): MathSlot | null {
  return currentSubjectSlot(w, classId, (s) => s.isMathsChallenge);
}

/** Why a class can't play right now, for a friendly message (not shown when `currentMathsSlot` finds a slot). */
export function mathStatusForClass(w: World, classId: number | null): "not_school_day" | "no_class" | "upcoming" | "complete" | "no_maths" {
  const status = subjectStatusForClass(w, classId, (s) => s.isMathsChallenge);
  return status === "not_scheduled" ? "no_maths" : status;
}

type Op = "+" | "−" | "×" | "÷";
const OPS: Op[] = ["+", "−", "×", "÷"];
const isMul = (op: Op) => op === "×" || op === "÷";

function apply(a: number, op: Op, b: number): number | null {
  switch (op) {
    case "+": return a + b;
    case "−": return a - b;
    case "×": return a * b;
    case "÷": return b !== 0 && a % b === 0 ? a / b : null;
  }
}

/** Standard order of operations: × and ÷ bind tighter than + and −; same precedence goes left to right. */
function evaluate(a: number, op1: Op, b: number, op2: Op, c: number): number | null {
  if (!isMul(op1) && isMul(op2)) {
    const bc = apply(b, op2, c);
    return bc === null ? null : apply(a, op1, bc);
  }
  const ab = apply(a, op1, b);
  return ab === null ? null : apply(ab, op2, c);
}

export interface MathQuestion {
  text: string;
  answer: number;
}

/** How long a "go toss it" window stays open once a student wins, before it hands them a new question. */
export const TOSS_WINDOW_MS = 10000;

/** Pure so it's the same check on the server (enforcing the minimum) and the client (the countdown). */
export function tossWindowExpired(wonAt: Date | string, now: number = Date.now()): boolean {
  return now - new Date(wonAt).getTime() >= TOSS_WINDOW_MS;
}

/**
 * A friendly two-step, times-table-range question (e.g. "2 × 6 ÷ 3"), guaranteed to have a
 * whole, non-negative answer: every ÷ step is checked to divide exactly before it's used.
 */
export function generateMathQuestion(rand: () => number = Math.random): MathQuestion {
  const int = () => 1 + Math.floor(rand() * 12);
  for (let tries = 0; tries < 40; tries++) {
    const a = int(), b = int(), c = int();
    const op1 = OPS[Math.floor(rand() * OPS.length)];
    const op2 = OPS[Math.floor(rand() * OPS.length)];
    const answer = evaluate(a, op1, b, op2, c);
    if (answer !== null && Number.isInteger(answer) && answer >= 0 && answer <= 144) {
      return { text: `${a} ${op1} ${b} ${op2} ${c}`, answer };
    }
  }
  // Practically unreachable (plain + always works), but never leaves the caller without a question.
  const a = int(), b = int();
  return { text: `${a} + ${b}`, answer: a + b };
}
