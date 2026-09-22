-- ============================================================================
--  Buzzer questions: an ordered bank an exec can prepare ahead of time (or add to live). "Question N"
--  in the round is just the Nth one here, in order — so the TV shows the real question and its
--  multiple-choice answers instead of a generic "buzz in" prompt. Running past the bank (or never
--  adding any questions at all) is fine: the round falls back to "ask one yourself", exactly as
--  before this existed.
--
--  The correct answer is never sent to a browser except an admin's, and only unredacted before a
--  buzz is resolved on the public/student-facing read — see src/lib/data/buzzer.ts.
-- ============================================================================

create table buzzer_questions (
  id             int generated always as identity primary key,
  question       text not null,
  choices        jsonb not null,
  correct_index  int not null,
  sort_order     int not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  check (jsonb_array_length(choices) >= 2),
  check (correct_index >= 0 and correct_index < jsonb_array_length(choices))
);
create index buzzer_questions_order_idx on buzzer_questions (sort_order, id);

create trigger buzzer_questions_touch before update on buzzer_questions
  for each row execute function touch_updated_at();
create trigger buzzer_questions_live after insert or update or delete on buzzer_questions
  for each statement execute function bump_live();

alter table buzzer_questions enable row level security;

-- Snapshot which question was actually asked at the moment a round is resolved, so editing the bank
-- afterwards (fixing a typo, adding more questions) never rewrites what the scoreboard already says.
alter table buzzer_rounds add column question_text text;
