-- `is_staff()` could not simply have its EXECUTE revoked: every RLS policy calls it
-- while evaluating queries for anon/authenticated, so denying them would deny access.
-- But living in `public` also published it as /rest/v1/rpc/is_staff.
--
-- PostgREST only exposes schemas on its exposed list (public, graphql_public), so
-- moving the helper to a private schema removes the endpoint while policies keep
-- working. This is the remediation the Supabase linter itself suggests.

create schema if not exists private;
revoke all on schema private from anon, authenticated;
grant usage on schema private to anon, authenticated;

create or replace function private.is_staff() returns boolean
language sql stable security definer set search_path = public, pg_catalog as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('moderator', 'admin') and not is_banned
  );
$$;

-- policy evaluation runs as the querying role, so it still needs EXECUTE
grant execute on function private.is_staff() to anon, authenticated;

-- Repoint every policy before dropping the old function; the dependency blocks it otherwise.
drop policy profiles_staff   on profiles;
drop policy categories_staff on categories;
drop policy offers_staff     on offers;
drop policy attrs_staff      on offer_attributes;
drop policy verif_staff      on verifications;
drop policy checks_staff     on link_checks;
drop policy subs_staff       on submissions;
drop policy comments_staff   on comments;

create policy profiles_staff   on profiles         for all using (private.is_staff()) with check (private.is_staff());
create policy categories_staff on categories       for all using (private.is_staff()) with check (private.is_staff());
create policy offers_staff     on offers           for all using (private.is_staff()) with check (private.is_staff());
create policy attrs_staff      on offer_attributes for all using (private.is_staff()) with check (private.is_staff());
create policy verif_staff      on verifications    for all using (private.is_staff()) with check (private.is_staff());
create policy checks_staff     on link_checks      for all using (private.is_staff()) with check (private.is_staff());
create policy subs_staff       on submissions      for all using (private.is_staff()) with check (private.is_staff());
create policy comments_staff   on comments         for all using (private.is_staff()) with check (private.is_staff());

-- the two trigger functions that consult it
create or replace function public.set_comment_status() returns trigger
language plpgsql security definer set search_path = public, pg_catalog as $$
declare
  published_count int;
begin
  if private.is_staff() then
    new.status := 'published';
    return new;
  end if;
  select count(*) into published_count
    from comments where author_id = new.author_id and status = 'published';
  new.status := case when published_count >= 3 then 'published' else 'pending' end;
  return new;
end $$;

create or replace function public.guard_comment_status() returns trigger
language plpgsql security definer set search_path = public, pg_catalog as $$
begin
  if auth.uid() is null or private.is_staff() then return new; end if;
  new.status       := old.status;
  new.mod_note     := old.mod_note;
  new.moderated_by := old.moderated_by;
  return new;
end $$;

revoke all on function public.set_comment_status()   from anon, authenticated, public;
revoke all on function public.guard_comment_status() from anon, authenticated, public;

drop function public.is_staff();
