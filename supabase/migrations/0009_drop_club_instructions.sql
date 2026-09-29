-- Clubs now only have a Description — "Activity instructions (how to earn the note)" was a separate
-- field that duplicated it in practice, so it's gone.
alter table clubs drop column if exists instructions;
