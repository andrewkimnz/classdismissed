import type { Sql } from "@/lib/db/sql";

export const KOIN_STARTING_BALANCE = 15;
export const KOIN_CLUB_REWARD = 5;

/**
 * Grants the Phase 2 starting balance to one student. Safe to call any number of times — the
 * partial unique index on koin_transactions makes a repeat a no-op.
 */
export async function grantKoinStartingBalance(sql: Sql, studentId: number): Promise<void> {
  await sql`
    insert into koin_transactions (student_id, delta, description, kind)
    values (${studentId}, ${KOIN_STARTING_BALANCE}, 'Phase 2 Starting Balance', 'starting_balance')
    on conflict (student_id) where kind = 'starting_balance' and revoked_at is null do nothing`;
}

/**
 * Grants every student currently missing one their Phase 2 starting balance — called once when
 * the event moves into After School, but safe to call again (e.g. a student added afterwards).
 * Returns how many were actually granted.
 */
export async function grantAllKoinStartingBalances(sql: Sql): Promise<number> {
  const rows = await sql<{ id: number }>`
    insert into koin_transactions (student_id, delta, description, kind)
    select id, ${KOIN_STARTING_BALANCE}, 'Phase 2 Starting Balance', 'starting_balance' from students
    on conflict (student_id) where kind = 'starting_balance' and revoked_at is null do nothing
    returning id`;
  return rows.length;
}

/**
 * Awards the club-completion Koin bonus to every student in the class, tied to this specific
 * completion — so revoking it (and later re-awarding the same club, a fresh completion row) can
 * earn the Koins again, exactly like club_completions' own uniqueness already works.
 */
export async function grantClubCompletionKoins(
  sql: Sql,
  params: { classId: number; completionId: number; clubName: string },
): Promise<void> {
  const { classId, completionId, clubName } = params;
  await sql`
    insert into koin_transactions (student_id, delta, description, kind, completion_id)
    select id, ${KOIN_CLUB_REWARD}, ${`${clubName} Completed`}, 'club_completion', ${completionId}
    from students where class_id = ${classId}
    on conflict (student_id, completion_id) where kind = 'club_completion' and revoked_at is null do nothing`;
}

/** Reverses the club-completion Koins tied to a revoked completion. */
export async function revokeClubCompletionKoins(sql: Sql, completionId: number): Promise<void> {
  await sql`update koin_transactions set revoked_at = now() where completion_id = ${completionId} and revoked_at is null`;
}
