-- 0011 — remove two tables that never belonged to Studely.
--
-- On 2026-08-22 a separate, unrelated playtest (a café game prototype, build
-- "playtest-1") used this Supabase project as its event sink and created
-- cafe_playtest_events + cafe_playtest_events_archive through two migrations
-- that exist only in production (20260822193222, 20260822195603). The owner
-- confirmed on 2026-09-21 that it was accidental and asked for a full clean-up.
--
-- Why it mattered: the live table carried an anon INSERT policy (anyone with the
-- public anon key could write rows), and Studely's backup/restore round-trip
-- carried foreign data. The 25 archive rows were exported to a local, gitignored
-- backup before this ran.
--
-- Idempotent: a fresh database never had these tables.

drop table if exists public.cafe_playtest_events_archive;
drop table if exists public.cafe_playtest_events;
