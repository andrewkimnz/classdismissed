-- ============================================================================
--  Buzzer fairness delay: phones don't all refresh at the exact same instant,
--  so buzzing doesn't open the moment "Next question" is pressed — there's a
--  short, visible grace period first (see opens_at) so nobody's phone just
--  happened to load faster than everyone else's.
-- ============================================================================

alter table buzzer_state add column opens_at timestamptz;
