-- Only one risk level was ever really used, so it's no longer a choice — Principal's Office is just
-- Success or Caught now. The fixed numbers live in code (src/lib/domain/principal.ts); attempts already
-- snapshot their own tier_name/tier_icon/success_delta/failure_delta/failure_detention on the row, so
-- history is untouched.
alter table principal_attempts drop column if exists risk_tier_id;
drop table if exists risk_tiers;
