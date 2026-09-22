import { cache } from "react";
import { sql as globalSql } from "@/lib/db/client";
import type { Sql } from "@/lib/db/sql";
import type { MathChallengeRow } from "@/lib/types";
import { generateMathQuestion, TOSS_WINDOW_MS } from "@/lib/domain/math";

/**
 * If this row's "go toss it" window has genuinely run out (server time, not whatever the client
 * claims), close it out and hand back a fresh question — same row, ready to earn another toss.
 * Called on every read, so a page load alone is enough to self-heal a student who never got the
 * client-side timer (backgrounded tab, JS didn't run, …).
 */
async function autoCompleteIfExpired(sql: Sql, row: MathChallengeRow): Promise<MathChallengeRow> {
  if (row.status !== "ready" || !row.wonAt) return row;
  const q = generateMathQuestion();
  const [next] = await sql<MathChallengeRow>`
    update math_challenges set status = 'playing', streak = 0, tosses = tosses + 1, question = ${q.text}, answer = ${q.answer},
      won_at = null, last_tossed_at = now(), last_tossed_by = null
    where id = ${row.id} and status = 'ready' and extract(epoch from (now() - won_at)) * 1000 >= ${TOSS_WINDOW_MS}
    returning *`;
  return next ?? row; // window not actually up yet: hand back the still-ready row unchanged
}

/**
 * The student's own row for this period, creating one with a first question if this is their first
 * visit this period. `on conflict … do update` (a harmless no-op set) is what makes this atomic and
 * still return the existing row when two requests race (e.g. two tabs loading at once).
 */
export async function getActiveChallenge(sql: Sql, studentId: number, periodId: number): Promise<MathChallengeRow> {
  const q = generateMathQuestion();
  const [row] = await sql<MathChallengeRow>`
    insert into math_challenges (student_id, period_id, question, answer)
    values (${studentId}, ${periodId}, ${q.text}, ${q.answer})
    on conflict (student_id, period_id) do update set student_id = excluded.student_id
    returning *`;
  return autoCompleteIfExpired(sql, row);
}

/** An exec ends a ready window early (the student already tossed, or a mis-tap needs fixing). */
export async function clearTossWindow(sql: Sql, id: number, adminId: number): Promise<{ name: string } | null> {
  const q = generateMathQuestion();
  const [row] = await sql<{ name: string }>`
    update math_challenges m set status = 'playing', streak = 0, tosses = tosses + 1, question = ${q.text}, answer = ${q.answer},
      won_at = null, last_tossed_at = now(), last_tossed_by = ${adminId}
    from students s where s.id = m.student_id and m.id = ${id} and m.status = 'ready'
    returning s.name`;
  return row ?? null;
}

export interface MathLeaderboardRow {
  id: number;
  studentId: number;
  studentName: string;
  classId: number | null;
  className: string | null;
  classColor: string | null;
  /** In their "go toss it" window right now — this is the live queue. */
  waiting: boolean;
  /** Toss windows completed this period. */
  tosses: number;
  wonAt: Date | null;
  lastTossedAt: Date | null;
}

/**
 * Everyone currently waiting to toss, plus everyone who has tossed at least once — never anyone
 * who's just mid-question, and never `question`/`answer`. Shown to every signed-in student, so it
 * must stay safe to expose.
 */
export const getMathLeaderboard = cache(async (): Promise<MathLeaderboardRow[]> =>
  globalSql<MathLeaderboardRow>`
    select m.id, m.student_id, s.name as student_name, s.class_id, c.name as class_name, c.color as class_color,
      (m.status = 'ready') as waiting, m.tosses, m.won_at, m.last_tossed_at
    from math_challenges m
    join students s on s.id = m.student_id
    left join classes c on c.id = s.class_id
    where m.status = 'ready' or m.tosses > 0
    order by m.won_at asc nulls last, m.last_tossed_at desc nulls last
    limit 200`);
