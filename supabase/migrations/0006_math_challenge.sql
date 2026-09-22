-- ============================================================================
--  Maths toss challenge: during School Day, while a class is in the subject flagged
--  below (MATHS by default), each student can solve 3 correct arithmetic questions
--  in a row on their phone to earn a turn at the toss game (paper planes / paper
--  basketball / bottle-cap flicking) run at the Maths table. A miss just resets
--  their streak to 0 and gives them a new question: no penalty, no limit on tries.
--
--  Winning opens a short "go toss it" window (TOSS_WINDOW_MS in src/lib/domain/math.ts):
--  status flips to 'ready' for a few seconds, then flips itself back to 'playing' with a
--  new question — no exec has to do anything for a student to get their next go. An exec
--  can still end the window early from the staff room ("Clear now").
--
--  One row per (student, period), reused for every toss that period: `question`/`answer`
--  hold whatever is currently on screen (so a page refresh shows the same question, not a
--  new one), and `answer` is never selected by any query the student-facing pages use.
-- ============================================================================

alter table subjects add column is_maths_challenge boolean not null default false;
update subjects set is_maths_challenge = true where name ~* '^maths?$';

create table math_challenges (
  id              int generated always as identity primary key,
  student_id      int not null references students (id) on delete cascade,
  period_id       int not null references periods (id) on delete cascade,
  streak          int not null default 0 check (streak >= 0),
  attempts        int not null default 0 check (attempts >= 0),
  tosses          int not null default 0 check (tosses >= 0), -- toss windows completed this period
  question        text,   -- null while status = 'ready': nothing left to answer
  answer          int,    -- the correct answer for `question`; server-only, never sent to the browser
  status          text not null default 'playing' check (status in ('playing', 'ready')),
  won_at          timestamptz,   -- when the CURRENT ready window opened; null while playing
  last_tossed_at  timestamptz,   -- when a ready window last ended (auto or exec-cleared)
  last_tossed_by  int references admins (id) on delete set null,  -- set only when an exec cleared it early
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (student_id, period_id)
);

create index math_challenges_status_idx on math_challenges (status, won_at);

create trigger math_challenges_touch before update on math_challenges
  for each row execute function touch_updated_at();
create trigger math_challenges_live after insert or update or delete on math_challenges
  for each statement execute function bump_live();

alter table math_challenges enable row level security;
