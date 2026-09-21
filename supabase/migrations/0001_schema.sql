-- ============================================================================
--  KAC Academy — "Class Dismissed"  ·  core schema
--
--  Design notes
--  * One deployment = one event. `events` is a single-row table (id = 1) that
--    holds event identity, the live phase and every configurable rule
--    (this is the "event_settings" of the brief, kept typed and in one row).
--  * DERIVED VALUES ARE NOT STORED. A class's raw score, percentage and letter
--    grade are calculated from `class_subject_scores`; the *current* grade is
--    "original % + sum of active grade_modifications". Original results are
--    therefore always preserved, and reversing a modification is one UPDATE.
--  * Nothing an organiser does is destroyed: notes, completions, attempts,
--    modifications and detentions are soft-reversed (revoked / voided /
--    cancelled) and every organiser action lands in `audit_log`.
--  * Plain integer identity keys, no bigint/numeric columns: keeps values as
--    ordinary JS numbers with every Postgres driver.
--  * Works on Supabase Postgres and on embedded PGlite (local demo).
-- ============================================================================

-- ── helpers ─────────────────────────────────────────────────────────────────
create or replace function touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ── event (singleton) ───────────────────────────────────────────────────────
create table events (
  id                      int primary key default 1 check (id = 1),
  name                    text not null default 'KAC Presents: Class Dismissed',
  tagline                 text not null default 'The final bell has rung.',
  event_date              date not null default '2026-10-02',
  timezone                text not null default 'Pacific/Auckland',
  venue                   text not null default 'University of Auckland',
  assembly_point          text not null default 'the starting lecture theatre',

  phase                   text not null default 'school_day'
                          check (phase in ('school_day', 'after_school', 'event_complete')),
  phase_changed_at        timestamptz not null default now(),

  scoring_locked          boolean not null default false,
  leaderboard_mode        text not null default 'exact'
                          check (leaderboard_mode in ('exact', 'grades', 'hidden')),

  -- Phase 1 timetable driver. 'manual': organisers ring the bell and press
  -- "next rotation" (robust when the night runs late). 'clock': automatic.
  timetable_mode          text not null default 'manual'
                          check (timetable_mode in ('manual', 'clock')),
  current_period          int  not null default 0 check (current_period >= 0),

  -- Principal's Office rules
  principal_open          boolean not null default true,
  notes_required          int  not null default 3 check (notes_required >= 0),
  -- 'threshold': having N notes unlocks unlimited attempts.
  -- 'per_attempt': every attempt consumes N notes.
  attempt_policy          text not null default 'threshold'
                          check (attempt_policy in ('threshold', 'per_attempt')),
  principal_room          text not null default '201-321',
  detention_room          text not null default '201-320',
  detention_instructions  text not null default 'Report to the detention room and complete your task before rejoining the festival.',

  updated_at              timestamptz not null default now()
);

-- ── staff accounts ─────────────────────────────────────────────────────────
create table admins (
  id              int generated always as identity primary key,
  email           text not null,
  name            text not null,
  -- 'admin' = full control.  'teacher' = game master (scores, notes,
  -- Principal's Office, detention) but no structural configuration.
  role            text not null default 'admin' check (role in ('admin', 'teacher')),
  password_hash   text not null,
  active          boolean not null default true,
  last_login_at   timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create unique index admins_email_key on admins (lower(email));

-- ── classes ────────────────────────────────────────────────────────────────
create table classes (
  id          int generated always as identity primary key,
  name        text not null,
  color       text not null default '#E8628C',
  motto       text not null default '',
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index classes_name_key on classes (lower(name));

-- ── students ───────────────────────────────────────────────────────────────
create table students (
  id               int generated always as identity primary key,
  student_no       int  not null unique check (student_no > 0),      -- shown as KAC-042
  name             text not null,
  class_id         int references classes (id) on delete set null,
  login_code       text not null unique,                             -- normalised, no dashes
  session_version  int  not null default 0,                          -- bump to sign out every phone
  attendance       text not null default 'expected'
                   check (attendance in ('expected', 'present', 'absent')),
  checked_in_at    timestamptz,
  custom_award     text,                                             -- overrides the auto "funny award"
  notes            text not null default '',                         -- organiser-only
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index students_class_idx on students (class_id);

-- ── Phase 1: subjects, periods, rotations, scores ──────────────────────────
create table subjects (
  id           int generated always as identity primary key,
  name         text not null,
  tagline      text not null default '',
  description  text not null default '',
  activity     text not null default '',
  icon         text not null default '📚',
  color        text not null default '#4F7CFF',
  max_score    int  not null default 20 check (max_score > 0),
  rooms        jsonb not null default '[]'::jsonb,   -- pool of rooms used by the auto-timetable
  sort_order   int  not null default 0,
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table periods (
  id          int generated always as identity primary key,
  number      int  not null unique check (number > 0),
  starts_at   timestamptz not null,
  ends_at     timestamptz not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (ends_at > starts_at)
);

-- One row per (period, class): which subject, in which room.
create table rotations (
  id          int generated always as identity primary key,
  period_id   int not null references periods (id) on delete cascade,
  class_id    int not null references classes (id) on delete cascade,
  subject_id  int not null references subjects (id) on delete cascade,
  room        text not null default '',
  updated_at  timestamptz not null default now(),
  unique (period_id, class_id)
);

-- One class-level mark per (class, subject).
create table class_subject_scores (
  id          int generated always as identity primary key,
  class_id    int not null references classes (id) on delete cascade,
  subject_id  int not null references subjects (id) on delete cascade,
  score       double precision not null check (score >= 0),
  entered_by  int references admins (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (class_id, subject_id)
);

-- Percentage → letter. A row applies from `min_percent` upwards.
create table grade_boundaries (
  id           int generated always as identity primary key,
  grade        text not null unique,
  min_percent  double precision not null unique check (min_percent >= 0 and min_percent <= 100)
);

-- ── Phase 2: clubs, completions, Teacher's Notes ───────────────────────────
create table clubs (
  id            int generated always as identity primary key,
  name          text not null,
  icon          text not null default '🎒',
  color         text not null default '#F8B4C8',
  image_url     text,
  description   text not null default '',
  instructions  text not null default '',
  room          text not null default '',
  is_open       boolean not null default true,
  awards_note   boolean not null default true,
  sort_order    int not null default 0,
  archived_at   timestamptz,                       -- "removed" clubs are archived, never deleted
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table club_completions (
  id             int generated always as identity primary key,
  student_id     int not null references students (id) on delete cascade,
  club_id        int not null references clubs (id) on delete cascade,
  awarded_by     int references admins (id) on delete set null,
  created_at     timestamptz not null default now(),
  revoked_at     timestamptz,
  revoked_by     int references admins (id) on delete set null,
  revoke_reason  text
);
-- Double-tap protection: one active completion per student per club.
create unique index club_completions_active_key
  on club_completions (student_id, club_id) where revoked_at is null;

create table teacher_notes (
  id             int generated always as identity primary key,
  student_id     int not null references students (id) on delete cascade,
  club_id        int references clubs (id) on delete set null,
  completion_id  int references club_completions (id) on delete set null,
  reason         text not null default '',           -- for bonus notes with no club
  issued_by      int references admins (id) on delete set null,
  created_at     timestamptz not null default now(),
  revoked_at     timestamptz,
  revoked_by     int references admins (id) on delete set null,
  revoke_reason  text
);
create unique index teacher_notes_active_club_key
  on teacher_notes (student_id, club_id) where revoked_at is null and club_id is not null;
create index teacher_notes_student_idx on teacher_notes (student_id);

-- ── Principal's Office ─────────────────────────────────────────────────────
create table risk_tiers (
  id                 int generated always as identity primary key,
  name               text not null,
  description        text not null default '',
  success_delta      double precision not null default 0,   -- percentage points
  failure_delta      double precision not null default 0,   -- percentage points (negative = penalty)
  failure_detention  boolean not null default false,
  icon               text not null default '🎲',
  enabled            boolean not null default true,
  sort_order         int not null default 0
);

create table principal_attempts (
  id                 int generated always as identity primary key,
  student_id         int not null references students (id) on delete cascade,
  class_id           int references classes (id) on delete set null,
  -- requested: student asked, waiting for an exec.  resolved: outcome recorded.
  -- cancelled: request withdrawn.  voided: a recorded attempt reversed by an exec.
  status             text not null default 'requested'
                     check (status in ('requested', 'resolved', 'cancelled', 'voided')),
  risk_tier_id       int references risk_tiers (id) on delete set null,
  -- Snapshots so later edits to a tier never rewrite history.
  tier_name          text not null default '',
  tier_icon          text not null default '🎲',
  success_delta      double precision not null default 0,
  failure_delta      double precision not null default 0,
  failure_detention  boolean not null default false,
  outcome            text check (outcome in ('success', 'failure')),
  delta_applied      double precision,
  notes              text not null default '',
  requested_at       timestamptz not null default now(),
  resolved_at        timestamptz,
  resolved_by        int references admins (id) on delete set null,
  voided_at          timestamptz,
  voided_by          int references admins (id) on delete set null,
  void_reason        text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
-- A student can only have one open request at a time.
create unique index principal_attempts_one_open_key
  on principal_attempts (student_id) where status = 'requested';
create index principal_attempts_student_idx on principal_attempts (student_id);

-- Every change to a class's grade after the school day. Reversible.
create table grade_modifications (
  id             int generated always as identity primary key,
  class_id       int not null references classes (id) on delete cascade,
  student_id     int references students (id) on delete set null,
  attempt_id     int references principal_attempts (id) on delete set null,
  kind           text not null default 'principal_attempt'
                 check (kind in ('principal_attempt', 'manual')),
  delta_percent  double precision not null,
  reason         text not null default '',
  created_by     int references admins (id) on delete set null,
  created_at     timestamptz not null default now(),
  revoked_at     timestamptz,
  revoked_by     int references admins (id) on delete set null,
  revoke_reason  text
);
create index grade_modifications_class_idx on grade_modifications (class_id);

-- ── Detention ──────────────────────────────────────────────────────────────
create table detentions (
  id            int generated always as identity primary key,
  student_id    int not null references students (id) on delete cascade,
  attempt_id    int references principal_attempts (id) on delete set null,
  reason        text not null default '',
  room          text not null default '',
  status        text not null default 'pending' check (status in ('pending', 'served', 'cancelled')),
  entered_at    timestamptz not null default now(),
  released_at   timestamptz,
  released_by   int references admins (id) on delete set null,
  created_by    int references admins (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index detentions_student_idx on detentions (student_id);
create index detentions_pending_idx on detentions (status) where status = 'pending';

-- ── Photos (ID photos, final photos, class/team photos) ────────────────────
create table photos (
  id            int generated always as identity primary key,
  kind          text not null check (kind in ('student_id', 'final', 'class_team')),
  student_id    int references students (id) on delete cascade,
  class_id      int references classes (id) on delete cascade,
  url           text not null,
  storage_path  text not null,
  is_current    boolean not null default true,       -- older uploads are kept, so a swap is undoable
  uploaded_by   int references admins (id) on delete set null,
  created_at    timestamptz not null default now(),
  check ((kind = 'class_team' and class_id is not null) or (kind <> 'class_team' and student_id is not null))
);
create unique index photos_current_student_key
  on photos (student_id, kind) where is_current and student_id is not null;
create unique index photos_current_class_key
  on photos (class_id, kind) where is_current and class_id is not null;

-- ── Audit trail ────────────────────────────────────────────────────────────
create table audit_log (
  id          int generated always as identity primary key,
  at          timestamptz not null default now(),
  admin_id    int references admins (id) on delete set null,
  admin_name  text not null default 'system',
  action      text not null,
  entity      text not null default '',
  entity_id   int,
  summary     text not null,
  data        jsonb
);
create index audit_log_at_idx on audit_log (at desc);

-- ── Realtime heartbeat ─────────────────────────────────────────────────────
-- A single counter that ticks whenever anything a student can see changes.
-- Phones subscribe to this one row (Supabase Realtime) and/or poll it, then
-- refetch their own page. It exposes no private data, so it is the only table
-- readable with the public anon key.
create table live_state (
  id          int primary key default 1 check (id = 1),
  rev         int not null default 0,
  updated_at  timestamptz not null default now()
);

create or replace function bump_live() returns trigger
language plpgsql as $$
begin
  update live_state set rev = rev + 1, updated_at = now() where id = 1;
  return null;
end $$;

-- ── triggers ───────────────────────────────────────────────────────────────
do $$
declare
  t text;
begin
  -- keep updated_at honest
  foreach t in array array[
    'events', 'admins', 'classes', 'students', 'subjects', 'periods', 'rotations',
    'class_subject_scores', 'clubs', 'principal_attempts', 'detentions'
  ] loop
    execute format(
      'create trigger %I before update on %I for each row execute function touch_updated_at()',
      t || '_touch', t);
  end loop;

  -- every table that can change what a student sees ticks the heartbeat
  foreach t in array array[
    'events', 'students', 'classes', 'subjects', 'periods', 'rotations',
    'class_subject_scores', 'grade_boundaries', 'clubs', 'club_completions',
    'teacher_notes', 'risk_tiers', 'principal_attempts', 'grade_modifications',
    'detentions', 'photos'
  ] loop
    execute format(
      'create trigger %I after insert or update or delete on %I for each statement execute function bump_live()',
      t || '_live', t);
  end loop;
end $$;

-- ── seed the singletons ────────────────────────────────────────────────────
insert into events (id) values (1);
insert into live_state (id) values (1);

-- ── row level security ─────────────────────────────────────────────────────
-- The app talks to Postgres server-side only (service connection), which
-- bypasses RLS. Turning RLS on with no policies means the public anon key can
-- read NOTHING — except the heartbeat row below.
do $$
declare
  t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- ── Supabase-only wiring (skipped automatically on plain Postgres/PGlite) ──
-- Each step is best-effort: if a Supabase permission or version difference blocks one,
-- the migration still succeeds and the README lists the manual dashboard equivalent.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    begin
      execute 'create policy live_state_public_read on public.live_state for select to anon, authenticated using (true)';
    exception when others then raise notice 'skipped live_state policy: %', sqlerrm;
    end;
  end if;

  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      execute 'alter publication supabase_realtime add table public.live_state';
    exception when others then raise notice 'skipped realtime publication: %', sqlerrm;
    end;
  end if;

  if exists (select 1 from pg_namespace where nspname = 'storage') then
    -- Public-read bucket for ID photos. Uploads happen server-side with the
    -- service role, so no storage policies are needed for writes.
    begin
      execute $q$
        insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
        values ('photos', 'photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
        on conflict (id) do nothing
      $q$;
    exception when others then raise notice 'skipped storage bucket: %', sqlerrm;
    end;
  end if;
end $$;
