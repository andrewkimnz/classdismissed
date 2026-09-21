-- Students no longer request Principal's Office attempts (an exec runs it in person),
-- so the "Principal's Office open" switch is gone.
alter table events drop column if exists principal_open;
