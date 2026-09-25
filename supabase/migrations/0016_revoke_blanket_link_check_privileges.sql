-- 0015 opened the check history by column and was wrong about what that
-- achieved. Postgres takes the UNION of table-level and column-level
-- privileges, and this database still carries the blanket grants every table
-- got when the project was created: anon and authenticated held
-- SELECT/INSERT/UPDATE/DELETE on link_checks outright. Only RLS stood in the
-- way — so the moment 0015 added a read policy for published offers, the
-- diagnostics (status_code, error, final_url) became readable too, and the
-- column grant next to it did nothing.
--
-- Verified as `anon` inside a rolled-back transaction: `select error from
-- link_checks` succeeded before this migration and is refused after it.
--
-- The write privileges go as well. Nothing public has ever been allowed to
-- write a check — that is record_link_check_batch, service_role only — and
-- leaving INSERT/UPDATE/DELETE granted meant one careless policy stood between
-- the public and the register's evidence.

revoke all on public.link_checks from anon, authenticated;

-- Now the column grant is the whole story: four published facts, read only.
grant select (offer_id, checked_at, result, note) on public.link_checks to anon;
grant select (offer_id, checked_at, result, note) on public.link_checks to authenticated;
