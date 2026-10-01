-- ============================================================================
--  Buzzer steal: when the team that buzzes in answers wrong, the OTHER team(s)
--  currently eligible get one chance to steal — buzzing re-opens but excludes
--  the class that just missed it. A second wrong answer awards nothing and the
--  exec moves on to the next question.
-- ============================================================================

alter table buzzer_state add column locked_out_class_id int references classes (id) on delete set null;
