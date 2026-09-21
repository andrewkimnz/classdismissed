"use server";

import { z } from "zod";
import { audit, parse, run, UserError, type ActionResult } from "@/lib/actions";
import { applyOutcome, reverseAttemptEffects } from "@/lib/attempts";
import { loadWorld } from "@/lib/data/load-world";
import { notesToSpend, principalAccess } from "@/lib/domain/principal";
import { formatDelta } from "@/lib/domain/grades";

const id = z.number().int().positive();

/**
 * Record what happened in the Principal's Office. The attempt is made by a whole CLASS
 * (the team goes in together), it spends the required Teacher's Notes, and a caught result
 * on a detention tier sends the whole class. It spends the required notes (or only what the class has if overridden). Also used to correct a result already recorded
 * (success ↔ caught): pass its `attemptId`.
 */
export async function recordAttempt(input: {
  classId: number; outcome: "success" | "failure"; tierId?: number; notes?: string; attemptId?: number; force?: boolean;
}): Promise<ActionResult> {
  return run("principal", async (ctx) => {
    const v = parse(
      z.object({ classId: id, outcome: z.enum(["success", "failure"]), tierId: id.optional(), notes: z.string().trim().max(300).optional(), attemptId: id.optional(), force: z.boolean().optional() }),
      input,
    );
    const [klass] = await ctx.sql<{ name: string }>`select name from classes where id = ${v.classId}`;
    if (!klass) throw new UserError("That class no longer exists.");

    let attemptId = v.attemptId;
    if (!attemptId) {
      // New attempt. Warn (don't block) if the class hasn't earned enough notes.
      if (!v.tierId) throw new UserError("Choose a risk level first.");
      const w = await loadWorld(ctx.sql);
      const access = principalAccess(w, { id: v.classId });
      if (!access.eligible && !v.force) {
        const why = access.block === "phase"
          ? "The event isn't in After School."
          : `Class ${klass.name} has ${access.available} note${access.available === 1 ? "" : "s"} available and needs ${access.required} per attempt.`;
        throw new UserError(`${why} Tick "Allow anyway" to record it regardless.`);
      }
      const [tier] = await ctx.sql<{ id: number }>`select id from risk_tiers where id = ${v.tierId}`;
      if (!tier) throw new UserError("That risk level no longer exists.");
      const [a] = await ctx.sql<{ id: number }>`
        insert into principal_attempts (class_id, status, risk_tier_id, tier_name, tier_icon, success_delta, failure_delta, failure_detention, notes_spent)
        select ${v.classId}::int, 'requested', t.id, t.name, t.icon, t.success_delta, t.failure_delta, t.failure_detention, ${notesToSpend(access)}::int
        from risk_tiers t where t.id = ${v.tierId} returning id`;
      attemptId = a.id;
    }

    const { attempt, delta, detained } = await applyOutcome(ctx.sql, { attemptId, outcome: v.outcome, tierId: v.tierId, notes: v.notes, actorId: ctx.actor.id });
    if (attempt.classId !== v.classId) throw new UserError("That attempt belongs to a different class.");
    const summary = `Class ${klass.name} ${v.outcome === "success" ? "broke in" : "was caught"} (${attempt.tierName}, ${delta ? formatDelta(delta) : "no grade change"}${detained ? ", whole class to detention" : ""})`;
    await audit(ctx, "attempt.resolve", summary, { entity: "class", entityId: v.classId, data: { attemptId: attempt.id, outcome: v.outcome, delta } });
    return { message: `${summary}.` };
  });
}

/** Reverse a recorded attempt entirely: grade change undone, detentions cancelled, and its notes are refunded. */
export async function voidAttempt(input: { attemptId: number; reason?: string }): Promise<ActionResult> {
  return run("principal", async (ctx) => {
    const v = parse(z.object({ attemptId: id, reason: z.string().trim().max(200).optional() }), input);
    const [a] = await ctx.sql<{ status: string; classId: number }>`select status, class_id from principal_attempts where id = ${v.attemptId} for update`;
    if (!a) throw new UserError("That attempt no longer exists.");
    if (a.status !== "resolved") throw new UserError("That attempt is already cancelled.");
    await reverseAttemptEffects(ctx.sql, v.attemptId, ctx.actor.id, v.reason ?? "Attempt voided");
    await ctx.sql`update principal_attempts set status = 'voided', voided_at = now(), voided_by = ${ctx.actor.id}, void_reason = ${v.reason ?? "Voided by staff"} where id = ${v.attemptId}`;
    await audit(ctx, "attempt.void", "Attempt voided (grade change reversed, detentions cancelled, notes refunded)", { entity: "class", entityId: a.classId, data: v });
    return { message: "Attempt voided. The class grade, detentions and Teacher's Notes were restored." };
  });
}

/** A manual grade adjustment (fixing a mistake, a bonus, a penalty). Reversible like any other. */
export async function adjustGrade(input: { classId: number; delta: number; reason: string }): Promise<ActionResult> {
  return run("manage", async (ctx) => {
    const v = parse(z.object({ classId: id, delta: z.number().min(-100).max(100).refine((n) => n !== 0, "Enter a non-zero change"), reason: z.string().trim().min(1, "Say why").max(200) }), input);
    const [klass] = await ctx.sql<{ name: string }>`select name from classes where id = ${v.classId}`;
    if (!klass) throw new UserError("That class no longer exists.");
    await ctx.sql`insert into grade_modifications (class_id, kind, delta_percent, reason, created_by) values (${v.classId}, 'manual', ${v.delta}, ${v.reason}, ${ctx.actor.id})`;
    await audit(ctx, "grade.adjust", `${klass.name}: ${formatDelta(v.delta)} (${v.reason})`, { entity: "class", entityId: v.classId, data: v });
    return { message: `${klass.name} ${formatDelta(v.delta)}.` };
  });
}

export async function revokeModification(input: { modId: number; reason?: string }): Promise<ActionResult> {
  return run("principal", async (ctx) => {
    const v = parse(z.object({ modId: id, reason: z.string().trim().max(200).optional() }), input);
    const rows = await ctx.sql<{ classId: number; deltaPercent: number }>`
      update grade_modifications set revoked_at = now(), revoked_by = ${ctx.actor.id}, revoke_reason = ${v.reason ?? "Reversed by staff"}
      where id = ${v.modId} and revoked_at is null returning class_id, delta_percent`;
    if (!rows.length) throw new UserError("That was already reversed.");
    await audit(ctx, "grade.revoke", `Grade change ${formatDelta(rows[0].deltaPercent)} reversed`, { entity: "class", entityId: rows[0].classId, data: v });
    return { message: `Reversed ${formatDelta(rows[0].deltaPercent)}. The class grade has been recalculated.` };
  });
}
