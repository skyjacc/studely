-- 0003 revoked these from PUBLIC, which was not enough: Supabase's default
-- privileges grant EXECUTE directly to anon and authenticated for every new
-- function in `public`, and revoking PUBLIC leaves those direct grants intact.
--
-- Both are trigger functions. Nothing should call them over PostgREST, and
-- revoking does not affect the triggers: EXECUTE is checked when CREATE TRIGGER
-- runs, not when the trigger fires. Demonstrated by handle_new_user, which still
-- auto-created a profile after its own grants were stripped.
revoke all on function public.guard_comment_status() from anon, authenticated, public;
revoke all on function public.guard_profile_privileges() from anon, authenticated, public;
