-- ============================================================================
--  Team play: Teacher's Notes and Principal's Office attempts belong to CLASSES.
--
--  Even though After School is free-flow, classes walk around together. So a
--  club is completed by a class, a note is earned by a class, and an attempt is
--  made by a class. Each attempt now SPENDS the required number of notes
--  (available = earned - spent, derived, so voiding an attempt refunds them).
--
--  Existing individual records are folded into their class: one completion and
--  one note per class per club (extras are kept but revoked, never deleted).
-- ============================================================================

-- ── club completions: (class, club) ─────────────────────────────────────────
alter table club_completions add column class_id int references classes (id) on delete cascade;
update club_completions c set class_id = s.class_id from students s where s.id = c.student_id;

update club_completions c
   set revoked_at = now(), revoke_reason = 'Merged into class completion'
 where c.revoked_at is null and c.class_id is not null
   and exists (select 1 from club_completions o
                where o.class_id = c.class_id and o.club_id = c.club_id and o.revoked_at is null and o.id < c.id);

-- the notes those merged completions earned are revoked with them
update teacher_notes n
   set revoked_at = now(), revoke_reason = 'Merged into class completion'
 where n.revoked_at is null
   and n.completion_id in (select id from club_completions where revoked_at is not null);

delete from club_completions where class_id is null;          -- students who never had a class
alter table club_completions alter column class_id set not null;
drop index if exists club_completions_active_key;
alter table club_completions drop column student_id;
create unique index club_completions_active_key on club_completions (class_id, club_id) where revoked_at is null;

-- ── teacher's notes: belong to a class ──────────────────────────────────────
alter table teacher_notes add column class_id int references classes (id) on delete cascade;
update teacher_notes n set class_id = s.class_id from students s where s.id = n.student_id;
delete from teacher_notes where class_id is null;
drop index if exists teacher_notes_active_club_key;
alter table teacher_notes drop column student_id;             -- also drops teacher_notes_student_idx
alter table teacher_notes alter column class_id set not null;
create unique index teacher_notes_active_club_key on teacher_notes (class_id, club_id) where revoked_at is null and club_id is not null;
create index teacher_notes_class_idx on teacher_notes (class_id);

-- ── principal's office attempts: made by a class ────────────────────────────
update principal_attempts a set class_id = s.class_id from students s where s.id = a.student_id and a.class_id is null;
delete from principal_attempts where class_id is null;
drop index if exists principal_attempts_one_open_key;
alter table principal_attempts drop column student_id;         -- also drops principal_attempts_student_idx
alter table principal_attempts drop constraint principal_attempts_class_id_fkey;
alter table principal_attempts alter column class_id set not null;
alter table principal_attempts add constraint principal_attempts_class_id_fkey foreign key (class_id) references classes (id) on delete cascade;
create index principal_attempts_class_idx on principal_attempts (class_id);

alter table grade_modifications drop column if exists student_id;

-- Attempts always spend notes now; the old "threshold vs per-attempt" choice is gone.
alter table events drop column if exists attempt_policy;
