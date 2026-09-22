-- ============================================================================
--  Buzzer: a live trivia round, for whichever subject is flagged below (SOCIAL STUDIES by default).
--  One shared round for the whole event, not per class — the exec asks one question at a time and
--  every currently-eligible student races to buzz in first, wherever their room is.
--
--  Flow: an exec presses "Next question" to move from "start of round" (question 0) to Q1, Q2, … Any
--  eligible student can buzz; the FIRST one locks it in (name/class/ID photo go up on the TV, so the
--  exec knows who to hand the question to). The exec marks that buzz correct or wrong — which also
--  logs it to buzzer_rounds, the running scoreboard — then moves on.
-- ============================================================================

alter table subjects add column is_buzzer_challenge boolean not null default false;
update subjects set is_buzzer_challenge = true where name ~* '^social\s*studies$';

-- The live round: one row (id = 1), like `events`.
create table buzzer_state (
  id                 int primary key default 1 check (id = 1),
  question_number    int not null default 0 check (question_number >= 0),  -- 0 = start of round: buzzing isn't open yet
  buzzed_student_id  int references students (id) on delete set null,
  buzzed_at          timestamptz,
  result             text check (result in ('correct', 'wrong')),          -- null = buzzed but not resolved yet
  updated_at         timestamptz not null default now()
);
insert into buzzer_state (id) values (1);

-- The scoreboard: one row per question that got a first buzz, whether it was resolved or the exec
-- moved on without ever resolving it ('unanswered').
create table buzzer_rounds (
  id               int generated always as identity primary key,
  question_number  int not null,
  student_id       int references students (id) on delete set null,
  class_id         int references classes (id) on delete set null,
  buzzed_at        timestamptz not null,
  result           text not null check (result in ('correct', 'wrong', 'unanswered')),
  resolved_by      int references admins (id) on delete set null,
  resolved_at      timestamptz not null default now(),
  created_at       timestamptz not null default now()
);
create index buzzer_rounds_question_idx on buzzer_rounds (question_number);
create index buzzer_rounds_class_idx on buzzer_rounds (class_id);

create trigger buzzer_state_touch before update on buzzer_state
  for each row execute function touch_updated_at();
create trigger buzzer_state_live after insert or update or delete on buzzer_state
  for each statement execute function bump_live();
create trigger buzzer_rounds_live after insert or update or delete on buzzer_rounds
  for each statement execute function bump_live();

alter table buzzer_state enable row level security;
alter table buzzer_rounds enable row level security;
