"use server";

import { z } from "zod";
import { audit, parse, run, UserError, type ActionResult } from "@/lib/actions";

const schema = z.object({
  classId: z.number().int().positive(),
  subjectId: z.number().int().positive(),
  score: z.number().min(0, "Score can't be negative"),
});

/** Save (or correct) a class's mark for a subject. Upsert, so re-saving is always safe. */
export async function saveScore(input: { classId: number; subjectId: number; score: number }): Promise<ActionResult<{ previous: number | null }>> {
  return run("score", async (ctx) => {
    const v = parse(schema, input);
    const [ev] = await ctx.sql<{ scoringLocked: boolean }>`select scoring_locked from events where id = 1`;
    if (ev.scoringLocked) throw new UserError("Scoring is locked. An admin can unlock it from Event Control.");
    const [subject] = await ctx.sql<{ name: string; maxScore: number }>`select name, max_score from subjects where id = ${v.subjectId}`;
    const [klass] = await ctx.sql<{ name: string }>`select name from classes where id = ${v.classId}`;
    if (!subject || !klass) throw new UserError("That class or subject no longer exists.");
    if (v.score > subject.maxScore) throw new UserError(`${subject.name} is out of ${subject.maxScore}.`);
    const [prev] = await ctx.sql<{ score: number }>`select score from class_subject_scores where class_id = ${v.classId} and subject_id = ${v.subjectId}`;
    await ctx.sql`
      insert into class_subject_scores (class_id, subject_id, score, entered_by) values (${v.classId}, ${v.subjectId}, ${v.score}, ${ctx.actor.id})
      on conflict (class_id, subject_id) do update set score = excluded.score, entered_by = excluded.entered_by`;
    await audit(
      ctx, "score.save",
      prev ? `${klass.name} ${subject.name}: ${prev.score} → ${v.score}/${subject.maxScore}` : `${klass.name} ${subject.name}: ${v.score}/${subject.maxScore}`,
      { entity: "class", entityId: v.classId, data: { subjectId: v.subjectId, from: prev?.score ?? null, to: v.score } },
    );
    return { message: `${klass.name} · ${subject.name}: ${v.score}/${subject.maxScore} saved.`, data: { previous: prev?.score ?? null } };
  });
}

/** Un-mark a class/subject (entered against the wrong class, say). */
export async function clearScore(input: { classId: number; subjectId: number }): Promise<ActionResult> {
  return run("score", async (ctx) => {
    const v = parse(schema.omit({ score: true }), input);
    const [ev] = await ctx.sql<{ scoringLocked: boolean }>`select scoring_locked from events where id = 1`;
    if (ev.scoringLocked) throw new UserError("Scoring is locked.");
    const rows = await ctx.sql<{ score: number }>`delete from class_subject_scores where class_id = ${v.classId} and subject_id = ${v.subjectId} returning score`;
    if (!rows.length) throw new UserError("There was no score to clear.");
    await audit(ctx, "score.clear", `Cleared a score (was ${rows[0].score})`, { entity: "class", entityId: v.classId, data: v });
    return { message: "Score cleared." };
  });
}
