-- ============================================================================
--  Each Principal's Office attempt now RECORDS how many Teacher's Notes it spent.
--
--  Before, spending was recalculated as (attempts x current notes-per-attempt), which had two flaws:
--   * an attempt recorded before a class had earned its notes (an "allow anyway" override) put the
--     class in DEBT, so notes earned afterwards silently paid it off and still showed 0;
--   * changing "notes per attempt" later rewrote every earlier balance.
--  Now an attempt spends min(cost, notes the class actually has) at the moment it is made, and that
--  number is kept. Voiding an attempt still refunds exactly what it spent.
-- ============================================================================
alter table principal_attempts add column notes_spent int not null default 0 check (notes_spent >= 0);

-- Repair existing attempts, oldest first per class: they spent whatever the class actually had
-- (notes earned by then, minus what earlier attempts had already spent), up to the cost.
do $$
declare
  a record;
  cost int;
  had int;
  used int;
begin
  select notes_required into cost from events where id = 1;
  for a in
    select id, class_id, created_at from principal_attempts
     where status in ('requested', 'resolved') order by class_id, id
  loop
    select count(*) into had from teacher_notes
     where class_id = a.class_id and revoked_at is null and created_at <= a.created_at;
    select coalesce(sum(notes_spent), 0) into used from principal_attempts
     where class_id = a.class_id and status in ('requested', 'resolved') and id < a.id;
    update principal_attempts set notes_spent = least(cost, greatest(0, had - used)) where id = a.id;
  end loop;
end $$;
