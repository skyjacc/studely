-- Fixes for the CRITICAL and HIGH findings from the backend audit.
--
-- CRITICAL: any signed-in user could make themselves an admin.
--   `profiles_update` allowed a self-update with `with check (id = auth.uid())` and
--   no column restriction. Supabase grants `authenticated` UPDATE on every column of
--   a public table, so `PATCH /rest/v1/profiles?id=eq.<self> {"role":"admin"}` with
--   the *public* anon key satisfied the policy. src/middleware.ts trusts
--   profiles.role, so that was a full admin takeover from an ordinary account.
--   The paired code fix is `shouldCreateUser: false` in src/pages/admin/login.astro,
--   which stopped the admin login form from doubling as a signup endpoint.
--
-- HIGH: any author could publish their own comment.
--   The moderation gate was BEFORE INSERT only, while `comments_update_own` let an
--   author update their own pending row with no restriction on `status`.

-- Column privileges are the real boundary; the triggers are defence in depth.
revoke update on profiles from authenticated;
grant  update (handle) on profiles to authenticated;

-- anon held table-level write privileges too. RLS blocked it (its policies need
-- id = auth.uid(), NULL for anon), but the unauthenticated role has no business
-- holding write grants on the table that decides who is an admin.
revoke update, insert, delete on profiles from anon;

-- No client inserts a profile: handle_new_user() is SECURITY DEFINER and runs as
-- the owner when auth.users gets a row.
revoke insert on profiles from authenticated;

create or replace function guard_profile_privileges() returns trigger
language plpgsql security definer
set search_path = public, pg_catalog
as $$
declare
  actor_role user_role;
begin
  -- service role / SQL console (no JWT): trusted, this is how the first admin is made
  if auth.uid() is null then return new; end if;

  select role into actor_role from profiles where id = auth.uid();

  -- Only a full admin may touch privilege columns, and never on their own row.
  -- That also closes the moderator-promotes-self hole the audit flagged separately.
  if actor_role = 'admin' and new.id <> auth.uid() then
    return new;
  end if;

  new.role      := old.role;
  new.trust     := old.trust;
  new.is_banned := old.is_banned;
  return new;
end $$;

create trigger profiles_guard_privileges
before update on profiles
for each row execute function guard_profile_privileges();

revoke all on function public.guard_profile_privileges() from public;

create or replace function guard_comment_status() returns trigger
language plpgsql security definer
set search_path = public, pg_catalog
as $$
begin
  if auth.uid() is null or is_staff() then return new; end if;
  new.status       := old.status;
  new.mod_note     := old.mod_note;
  new.moderated_by := old.moderated_by;
  return new;
end $$;

create trigger comments_guard_status
before update on comments
for each row execute function guard_comment_status();

revoke all on function public.guard_comment_status() from public;

-- `status` is NOT NULL DEFAULT 'pending', so the coalesce in the staff branch never
-- saw NULL and staff comments were filed as pending anyway. Make it do what it says.
create or replace function set_comment_status() returns trigger
language plpgsql security definer
set search_path = public, pg_catalog
as $$
declare
  published_count int;
begin
  if is_staff() then
    new.status := 'published';
    return new;
  end if;
  select count(*) into published_count
    from comments where author_id = new.author_id and status = 'published';
  new.status := case when published_count >= 3 then 'published' else 'pending' end;
  return new;
end $$;
