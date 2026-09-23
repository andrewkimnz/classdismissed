"use server";

import { z } from "zod";
import { audit, parse, run, runAsStudent, UserError, type ActionResult } from "@/lib/actions";
import { rateLimited } from "@/lib/auth/rate-limit";
import type { Sql } from "@/lib/db/sql";
import { getWorld } from "@/lib/data/world";
import { currentBuzzerSlot } from "@/lib/domain/buzzer";
import { resetBuzzerSession } from "@/lib/reset";
import { addSubjectPoints } from "@/lib/scoring";

const id = z.number().int().positive();

/** The prepared bank is just an ordered list: "question N" in the round is whichever one is Nth here. */
async function questionTextAt(sql: Sql, n: number): Promise<string | null> {
  if (n < 1) return null;
  const [row] = await sql<{ question: string }>`select question from buzzer_questions order by sort_order, id offset ${n - 1} limit 1`;
  return row?.question ?? null;
}

/** A student buzzes in. The first one to reach the database wins — the UPDATE's WHERE clause is what
 * makes that atomic: only a request that finds the round still unclaimed can claim it. */
export async function buzzIn(): Promise<ActionResult<{ won: boolean }>> {
  // Loaded before the transaction, not inside it: getWorld() runs on the app's shared connection, not
  // ctx.sql, so calling it once the transaction below is open would have it wait on a connection the
  // transaction itself is holding — a real deadlock against the single-connection embedded dev database.
  const world = await getWorld();
  return runAsStudent<{ won: boolean }>(async (ctx) => {
    if (rateLimited(`buzz:${ctx.studentId}`, 20, 60_000)) throw new UserError("Slow down a little, then try again.");

    const student = world.students.find((s) => s.id === ctx.studentId);
    if (!student) throw new UserError("Couldn't find your account. Reload and sign in again.");
    if (!currentBuzzerSlot(world, student.classId)) throw new UserError("Buzzer isn't your class's current class right now.");

    const [state] = await ctx.sql<{ questionNumber: number }>`select question_number from buzzer_state where id = 1`;
    if (!state || state.questionNumber < 1) throw new UserError("The round hasn't started yet.");

    const claimed = await ctx.sql<{ id: number }>`
      update buzzer_state set buzzed_student_id = ${ctx.studentId}, buzzed_at = now(), result = null
      where id = 1 and question_number = ${state.questionNumber} and buzzed_student_id is null
      returning id`;
    if (!claimed.length) return { message: "Someone beat you to it!", data: { won: false } };
    return { message: "You buzzed in first!", data: { won: true } };
  });
}

/** Moves from "start of round" (0) to Q1, then Q2, … A still-unresolved buzz is logged "unanswered" first. */
export async function nextBuzzerQuestion(): Promise<ActionResult> {
  return run("manage", async (ctx) => {
    const [state] = await ctx.sql<{ questionNumber: number; buzzedStudentId: number | null; result: string | null }>`
      select question_number, buzzed_student_id, result from buzzer_state where id = 1`;
    if (state.buzzedStudentId !== null && state.result === null) {
      const [student] = await ctx.sql<{ classId: number | null }>`select class_id from students where id = ${state.buzzedStudentId}`;
      const text = await questionTextAt(ctx.sql, state.questionNumber);
      await ctx.sql`
        insert into buzzer_rounds (question_number, student_id, class_id, buzzed_at, result, resolved_by, question_text)
        values (${state.questionNumber}, ${state.buzzedStudentId}, ${student?.classId ?? null}, now(), 'unanswered', ${ctx.actor.id}, ${text})`;
    }
    const next = state.questionNumber + 1;
    await ctx.sql`update buzzer_state set question_number = ${next}, buzzed_student_id = null, buzzed_at = null, result = null where id = 1`;
    await audit(ctx, "buzzer.next", `Buzzer: moved to question ${next}`, { entity: "buzzer_state" });
    return { message: `Now on question ${next}.` };
  });
}

/**
 * Marks the current buzz correct or wrong, and logs it to the scoreboard. A correct answer also adds
 * 1 point to the buzzing student's class's mark in whichever subject Buzzer is tied to (the one flagged
 * `is_buzzer_challenge`), capped at that subject's max — the same table Score entry writes to, so it
 * shows up on the leaderboard immediately. Skipped if scoring is locked, or if no subject is tied to
 * Buzzer right now; either way the buzz still gets marked.
 */
export async function resolveBuzz(input: { result: "correct" | "wrong" }): Promise<ActionResult> {
  return run("manage", async (ctx) => {
    const v = parse(z.object({ result: z.enum(["correct", "wrong"]) }), input);
    const [state] = await ctx.sql<{ questionNumber: number; buzzedStudentId: number | null; result: string | null }>`
      select question_number, buzzed_student_id, result from buzzer_state where id = 1`;
    if (state.buzzedStudentId === null) throw new UserError("Nobody's buzzed in yet.");
    if (state.result !== null) throw new UserError("Already marked.");
    const [student] = await ctx.sql<{ name: string; classId: number | null; className: string | null }>`
      select st.name, st.class_id, c.name as class_name from students st left join classes c on c.id = st.class_id where st.id = ${state.buzzedStudentId}`;
    const text = await questionTextAt(ctx.sql, state.questionNumber);
    await ctx.sql`update buzzer_state set result = ${v.result} where id = 1`;
    await ctx.sql`
      insert into buzzer_rounds (question_number, student_id, class_id, buzzed_at, result, resolved_by, question_text)
      values (${state.questionNumber}, ${state.buzzedStudentId}, ${student?.classId ?? null}, now(), ${v.result}, ${ctx.actor.id}, ${text})`;

    let scoreNote = "";
    if (v.result === "correct" && student?.classId) {
      const [ev] = await ctx.sql<{ scoringLocked: boolean }>`select scoring_locked from events where id = 1`;
      const [subject] = await ctx.sql<{ id: number; name: string; maxScore: number }>`select id, name, max_score from subjects where is_buzzer_challenge limit 1`;
      if (ev.scoringLocked) {
        scoreNote = " Scoring is locked, so no point was added.";
      } else if (subject) {
        const score = await addSubjectPoints(ctx.sql, { classId: student.classId, subjectId: subject.id, points: 1, maxScore: subject.maxScore, enteredBy: ctx.actor.id });
        scoreNote = ` +1 to ${student.className ?? "their class"}'s ${subject.name} (now ${score}/${subject.maxScore}).`;
      }
    }

    await audit(ctx, "buzzer.resolve", `Buzzer Q${state.questionNumber}: ${student?.name ?? "a student"} marked ${v.result}.${scoreNote}`, { entity: "buzzer_state" });
    return { message: `Marked ${v.result}.${scoreNote}` };
  });
}

/** Undoes a mis-tap or wrong buzz without advancing the question or touching the scoreboard: buzzing opens again for the same question. */
export async function clearBuzz(): Promise<ActionResult> {
  return run("manage", async (ctx) => {
    const rows = await ctx.sql<{ id: number }>`
      update buzzer_state set buzzed_student_id = null, buzzed_at = null, result = null where id = 1 and buzzed_student_id is not null returning id`;
    if (!rows.length) throw new UserError("Nobody's buzzed in.");
    await audit(ctx, "buzzer.clear", "Buzzer: cleared the buzz, open again", { entity: "buzzer_state" });
    return { message: "Cleared. Buzzing is open again for this question." };
  });
}

/**
 * Ends the current trivia session and starts a new one: back to "start of round" and the scoreboard
 * cleared. The prepared question bank is untouched — only what happened while playing it. Unlike
 * "Start the event fresh" (which resets the whole night), this only ever touches the buzzer.
 */
export async function resetBuzzerRound(): Promise<ActionResult> {
  return run("manage", async (ctx) => {
    const [{ n }] = await ctx.sql<{ n: number }>`select count(*)::int as n from buzzer_rounds`;
    await resetBuzzerSession(ctx.sql);
    await audit(ctx, "buzzer.reset", `Buzzer: started a new session (cleared ${n} scoreboard ${n === 1 ? "entry" : "entries"})`, { entity: "buzzer_state" });
    return { message: "New session started. Questions are untouched." };
  });
}

// ── question bank ────────────────────────────────────────────────────────
const questionSchema = z.object({
  question: z.string().trim().min(1, "Enter the question").max(500),
  choices: z.array(z.string().trim().min(1, "Choices can't be empty").max(200)).min(2, "At least 2 choices").max(6, "At most 6 choices"),
  correctIndex: z.number().int().min(0),
});
type QuestionInput = z.input<typeof questionSchema>;

function checkCorrectIndex(v: { choices: string[]; correctIndex: number }) {
  if (v.correctIndex >= v.choices.length) throw new UserError("Pick which choice is correct.");
}

export async function createBuzzerQuestion(input: QuestionInput): Promise<ActionResult> {
  return run("manage", async (ctx) => {
    const v = parse(questionSchema, input);
    checkCorrectIndex(v);
    await ctx.sql`
      insert into buzzer_questions (question, choices, correct_index, sort_order)
      values (${v.question}, ${v.choices}::jsonb, ${v.correctIndex}, (select coalesce(max(sort_order), 0) + 1 from buzzer_questions))`;
    await audit(ctx, "buzzer.question.create", `Buzzer question added: ${v.question.slice(0, 60)}`);
    return { message: "Question added." };
  });
}

export async function updateBuzzerQuestion(input: QuestionInput & { id: number }): Promise<ActionResult> {
  return run("manage", async (ctx) => {
    const v = parse(questionSchema.extend({ id }), input);
    checkCorrectIndex(v);
    const rows = await ctx.sql`
      update buzzer_questions set question = ${v.question}, choices = ${v.choices}::jsonb, correct_index = ${v.correctIndex}
      where id = ${v.id} returning id`;
    if (!rows.length) throw new UserError("That question no longer exists.");
    await audit(ctx, "buzzer.question.update", `Buzzer question updated: ${v.question.slice(0, 60)}`, { entity: "buzzer_question", entityId: v.id });
    return { message: "Question saved." };
  });
}

export async function deleteBuzzerQuestion(input: { id: number }): Promise<ActionResult> {
  return run("manage", async (ctx) => {
    const v = parse(z.object({ id }), input);
    const rows = await ctx.sql<{ question: string }>`delete from buzzer_questions where id = ${v.id} returning question`;
    if (!rows.length) throw new UserError("Already deleted.");
    await audit(ctx, "buzzer.question.delete", `Buzzer question deleted: ${rows[0].question.slice(0, 60)}`);
    return { message: "Question deleted. Rounds already played keep their own record of what was asked." };
  });
}

/** Swaps this question's play position with its neighbour. */
export async function moveBuzzerQuestion(input: { id: number; direction: "up" | "down" }): Promise<ActionResult> {
  return run("manage", async (ctx) => {
    const v = parse(z.object({ id, direction: z.enum(["up", "down"]) }), input);
    const rows = await ctx.sql<{ id: number; sortOrder: number }>`select id, sort_order from buzzer_questions order by sort_order, id`;
    const i = rows.findIndex((r) => r.id === v.id);
    if (i === -1) throw new UserError("That question no longer exists.");
    const j = v.direction === "up" ? i - 1 : i + 1;
    if (j < 0 || j >= rows.length) return { message: "Already at the end." };
    const [a, b] = [rows[i], rows[j]];
    await ctx.sql`update buzzer_questions set sort_order = ${b.sortOrder} where id = ${a.id}`;
    await ctx.sql`update buzzer_questions set sort_order = ${a.sortOrder} where id = ${b.id}`;
    return { message: "Reordered." };
  });
}
