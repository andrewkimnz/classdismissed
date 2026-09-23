"use server";

import { z } from "zod";
import { audit, parse, run, UserError, type ActionResult } from "@/lib/actions";
import { phaseLabel } from "@/lib/domain/phases";
import { resetBuzzerSession, resetEventData, resetMathChallenges } from "@/lib/reset";

const phaseSchema = z.enum(["school_day", "after_school", "event_complete"]);

/** THE big switch. Every student phone follows within seconds. */
export async function setPhase(input: { phase: string }): Promise<ActionResult> {
  return run("manage", async (ctx) => {
    const { phase } = parse(z.object({ phase: phaseSchema }), input);
    const [before] = await ctx.sql<{ phase: string }>`select phase from events where id = 1`;
    if (before.phase === phase) throw new UserError(`The event is already in ${phaseLabel(phase)}.`);
    await ctx.sql`update events set phase = ${phase}, phase_changed_at = now() where id = 1`;
    await audit(ctx, "event.phase", `Phase changed: ${phaseLabel(before.phase as never)} → ${phaseLabel(phase)}`, {
      entity: "event", entityId: 1, data: { from: before.phase, to: phase },
    });
    return { message: `Event is now in ${phaseLabel(phase)}. Student phones are updating.` };
  });
}

export async function setScoringLocked(input: { locked: boolean }): Promise<ActionResult> {
  return run("manage", async (ctx) => {
    const { locked } = parse(z.object({ locked: z.boolean() }), input);
    await ctx.sql`update events set scoring_locked = ${locked} where id = 1`;
    await audit(ctx, "event.scoring_lock", locked ? "Scoring locked" : "Scoring unlocked", { entity: "event", entityId: 1 });
    return { message: locked ? "Scoring is locked." : "Scoring is open." };
  });
}

export async function setLeaderboardMode(input: { mode: string }): Promise<ActionResult> {
  return run("manage", async (ctx) => {
    const { mode } = parse(z.object({ mode: z.enum(["exact", "grades", "hidden"]) }), input);
    await ctx.sql`update events set leaderboard_mode = ${mode} where id = 1`;
    await audit(ctx, "event.leaderboard", `Leaderboard mode: ${mode}`, { entity: "event", entityId: 1 });
    return { message: `Students now see: ${{ exact: "exact percentages", grades: "grades only", hidden: "no leaderboard" }[mode]}.` };
  });
}

export async function setTimetableMode(input: { mode: string }): Promise<ActionResult> {
  return run("manage", async (ctx) => {
    const { mode } = parse(z.object({ mode: z.enum(["manual", "clock"]) }), input);
    await ctx.sql`update events set timetable_mode = ${mode} where id = 1`;
    await audit(ctx, "event.timetable_mode", `Timetable driven by: ${mode === "manual" ? "organisers (bell button)" : "the clock"}`, { entity: "event", entityId: 1 });
    return { message: mode === "manual" ? "Rotations now advance when you ring the bell." : "Rotations now follow the clock." };
  });
}

/** 0 = school hasn't started · 1..n = that rotation is live · n+1 = school day finished. */
export async function setCurrentPeriod(input: { period: number }): Promise<ActionResult> {
  return run("manage", async (ctx) => {
    const { period } = parse(z.object({ period: z.number().int().min(0).max(99) }), input);
    const [before] = await ctx.sql<{ currentPeriod: number }>`select current_period from events where id = 1`;
    await ctx.sql`update events set current_period = ${period} where id = 1`;
    const count = (await ctx.sql<{ n: number }>`select count(*)::int as n from periods`)[0].n;
    const label = period === 0 ? "Before first bell" : period > count ? "School day finished" : `Rotation ${period} started`;
    // A new rotation puts different classes in Maths/Social Studies, so whatever the last group was
    // doing there stops being relevant — same reset as the manual buttons on each of those pages.
    let extra = "";
    if (period !== before.currentPeriod) {
      await resetMathChallenges(ctx.sql);
      await resetBuzzerSession(ctx.sql);
      extra = " Maths and Buzzer reset for the new rotation.";
    }
    await audit(ctx, "event.period", `🔔 ${label}.${extra}`, { entity: "event", entityId: 1, data: { period } });
    return { message: `🔔 ${label}.${extra}` };
  });
}

export async function setAllClubsOpen(input: { open: boolean }): Promise<ActionResult> {
  return run("manage", async (ctx) => {
    const { open } = parse(z.object({ open: z.boolean() }), input);
    await ctx.sql`update clubs set is_open = ${open} where archived_at is null`;
    await audit(ctx, "clubs.bulk_open", open ? "All clubs opened" : "All clubs closed");
    return { message: open ? "All clubs are open." : "All clubs are closed." };
  });
}

const settingsSchema = z.object({
  name: z.string().trim().min(1, "Give the event a name").max(120),
  tagline: z.string().trim().max(200),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date"),
  timezone: z.string().refine((tz) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  }, "Unknown timezone (try Pacific/Auckland)"),
  venue: z.string().trim().max(160),
  assemblyPoint: z.string().trim().max(160),
  notesRequired: z.number().int().min(0).max(50),
  principalRoom: z.string().trim().max(60),
  detentionRoom: z.string().trim().max(60),
  detentionInstructions: z.string().trim().max(400),
});

export async function updateEventSettings(input: z.input<typeof settingsSchema>): Promise<ActionResult> {
  return run("manage", async (ctx) => {
    const v = parse(settingsSchema, input);
    await ctx.sql`
      update events set name = ${v.name}, tagline = ${v.tagline}, event_date = ${v.eventDate}::date, timezone = ${v.timezone},
        venue = ${v.venue}, assembly_point = ${v.assemblyPoint}, notes_required = ${v.notesRequired},
        principal_room = ${v.principalRoom}, detention_room = ${v.detentionRoom},
        detention_instructions = ${v.detentionInstructions} where id = 1`;
    await audit(ctx, "event.settings", "Event settings updated", { entity: "event", entityId: 1, data: v });
    return { message: "Event settings saved." };
  });
}

/** Start the event fresh: clear everything that happened, keep everything set up beforehand (see lib/reset.ts). */
export async function resetEventActivity(input: { confirm: string }): Promise<ActionResult> {
  return run("manage", async (ctx) => {
    const { confirm } = parse(z.object({ confirm: z.string() }), input);
    if (confirm.trim().toUpperCase() !== "RESET") throw new UserError("Type RESET to confirm.");
    const n = await resetEventData(ctx.sql);
    await audit(ctx, "event.reset", `Event reset to a fresh start: cleared ${n.scores} scores, ${n.notes} notes, ${n.attempts} attempts, ${n.detentions} detentions and ${n.checkedIn} check-ins; back to School Day`, { data: n });
    return { message: "Fresh start. Back to School Day, before the first bell. Classes, students and setup are untouched." };
  });
}
