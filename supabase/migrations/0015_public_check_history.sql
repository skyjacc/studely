-- The record answers "why trust it" with a dated history: every check the
-- register has run on that offer, newest first, beside the human verifications
-- (which have been publicly readable since 0001). Until now the checks were not
-- readable at all — 0001 called link_checks "internal noise" and kept the whole
-- table to staff.
--
-- Both things are true: a check is a published fact (it ran on this date and
-- concluded this), and it is also an internal diagnostic (what the server
-- answered, where it redirected, which error the fetch threw). So the read is
-- opened by column, not by table:
--
--     public   offer_id · checked_at · result · note
--     private  ok · status_code · error · final_url · id
--
-- The policy narrows it further to offers that are actually published. Writing
-- stays exactly where it was: record_link_check_batch, service_role only.

-- Row access: published offers only, read only.
create policy checks_read_published on public.link_checks
  for select
  using (exists (select 1 from public.offers o where o.id = offer_id and o.visibility = 'published'));

-- Column access: the four published facts. Postgres requires the column grant
-- as well as the policy, so a `select *` still fails for these roles.
grant select (offer_id, checked_at, result, note) on public.link_checks to anon;
grant select (offer_id, checked_at, result, note) on public.link_checks to authenticated;
