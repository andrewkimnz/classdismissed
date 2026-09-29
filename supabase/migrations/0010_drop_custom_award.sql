-- The "special award" keepsake feature (automatic superlative + organiser override) is gone —
-- too messy to keep straight during the event.
alter table students drop column if exists custom_award;
