-- Fixes for the Supabase security linter findings against 0001.
--
-- Remaining accepted finding: `is_staff()` stays executable by anon/authenticated.
-- It reads only the caller's own row (`where id = auth.uid()`) and returns a
-- boolean they already know about themselves, so there is nothing to disclose —
-- and every RLS policy calls it while evaluating queries for exactly those roles,
-- so revoking EXECUTE would lock legitimate users out.

-- 1. The view ran with its creator's rights, exposing rating aggregates for
--    offers that are not published. Run it as the querying user instead.
alter view offer_ratings set (security_invoker = on);

-- 2. Pin search_path on the trigger functions that 0001 missed. A mutable
--    search_path lets a role shadow the unqualified names used inside.
create or replace function set_updated_at() returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
begin
  new.updated_at = now();
  return new;
end $$;

create or replace function recompute_offer_score() returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
declare
  target uuid := coalesce(new.offer_id, old.offer_id);
  total  int;
begin
  select coalesce(sum(points), 0) into total
    from offer_attributes where offer_id = target;
  update offers
     set score = greatest(1, least(10, 5 + total))
   where id = target;
  return null;
end $$;

-- 3. Remove the /rest/v1/rpc/ endpoints for the trigger functions. Postgres grants
--    EXECUTE to PUBLIC by default and anon/authenticated inherit it, so revoking
--    from those roles alone does nothing — it has to be revoked from PUBLIC.
--    Triggers still fire: EXECUTE is checked at CREATE TRIGGER, not at fire time.
revoke all on function public.handle_new_user() from public;
revoke all on function public.set_comment_status() from public;

-- 4. Public submissions stay open by design (that is the point of the queue), but
--    reject obvious junk at the boundary. Real abuse control — rate limiting and
--    a captcha — belongs in the app, not here.
drop policy subs_insert on submissions;
create policy subs_insert on submissions for insert
  with check (
    url ~* '^https?://[^\s]{4,}$'
    and char_length(url) <= 2000
    and (title is null or char_length(title) <= 200)
    and (note  is null or char_length(note)  <= 2000)
  );
