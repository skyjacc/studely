-- 0013 gave offers a projection of the latest link check and said the three
-- columns "always describe the SAME check". They did — but only because the one
-- writer behaved. Two holes were open to any service-role caller:
--
--   1. `note` was constrained on its own, so `pass` + `blocked` was storable:
--      an offer that answered 200 while claiming the provider blocks checks.
--   2. Nothing compared `checked_at` with what the projection already held, so
--      a re-run or a late batch could move `last_*` BACKWARDS —
--      Sep 25 pass, then a replayed Sep 24 warn, and the register would show a
--      warning the checker had already cleared.
--
-- Both become database rules here, not conventions. link_checks stays the
-- append-only history (a late row is still history and is still recorded); only
-- the projection is monotonic.

-- ------------------------------------------------- note belongs to a warn

-- Historical rows first: the derivation in 0013 already only set a note on
-- warns, but a row written between 0013 and here could disagree.
update public.link_checks set note = null where result <> 'warn' and note is not null;
update public.offers set last_check_note = null where last_check_result is distinct from 'warn' and last_check_note is not null;

alter table public.link_checks drop constraint if exists link_checks_note_check;
alter table public.link_checks
  add constraint link_checks_note_matches_result
  check (
    case when result = 'warn'
      then note is null or note in ('blocked', 'unreachable')
      else note is null
    end
  );

alter table public.offers drop constraint if exists offers_last_check_note_check;
alter table public.offers
  add constraint offers_note_matches_check_result
  check (
    case when last_check_result = 'warn'
      then last_check_note is null or last_check_note in ('blocked', 'unreachable')
      else last_check_note is null
    end
  );

-- ------------------------------------------------- the projection moves forward

create or replace function public.record_link_check_batch(checks jsonb)
returns integer
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  item jsonb;
  target_id uuid;
  target_status offer_status;
  item_result check_result;
  item_note text;
  item_checked timestamptz;
  written integer := 0;
begin
  -- Authorization stays at the function boundary (ADR-0008): EXECUTE is granted
  -- to service_role alone. A body-level role check would reject the intended
  -- caller, which is exactly the 0007 bug 0008 fixed.
  if jsonb_typeof(coalesce(checks, '[]'::jsonb)) <> 'array' then
    raise exception 'checks must be an array' using errcode = '22023';
  end if;

  for item in select value from jsonb_array_elements(coalesce(checks, '[]'::jsonb))
  loop
    target_id := (item->>'offer_id')::uuid;
    target_status := (item->>'offer_status')::offer_status;
    item_result := (item->>'result')::check_result;
    item_note := nullif(item->>'note', '');
    item_checked := coalesce((item->>'checked_at')::timestamptz, now());

    -- Say what is wrong at the boundary; the constraints below are the backstop.
    if item_note is not null and item_note not in ('blocked', 'unreachable') then
      raise exception 'unknown check note: %', item_note using errcode = '22023';
    end if;
    if item_result <> 'warn' and item_note is not null then
      raise exception 'a % check cannot carry the note %', item_result, item_note using errcode = '22023';
    end if;

    if not exists (select 1 from public.offers where id = target_id) then
      raise exception 'offer not found: %', target_id using errcode = '23503';
    end if;

    -- History is append-only and takes the row whatever its date.
    insert into public.link_checks (
      offer_id,
      ok,
      result,
      note,
      status_code,
      error,
      final_url,
      checked_at
    ) values (
      target_id,
      coalesce((item->>'ok')::boolean, false),
      item_result,
      item_note,
      case when item->>'status_code' is null then null else (item->>'status_code')::integer end,
      nullif(item->>'error', ''),
      nullif(item->>'final_url', ''),
      item_checked
    );

    -- The projection takes it only if it is the newest check we have seen. An
    -- equal timestamp still applies, so re-running a batch is idempotent rather
    -- than refused; an older one is recorded in history and ignored here.
    update public.offers
       set last_checked = item_checked,
           last_check_result = item_result,
           last_check_note = item_note,
           status = target_status
     where id = target_id
       and (last_checked is null or item_checked >= last_checked);

    written := written + 1;
  end loop;

  return written;
end $$;

revoke all on function public.record_link_check_batch(jsonb)
  from anon, authenticated, service_role, public;
grant execute on function public.record_link_check_batch(jsonb) to service_role;
