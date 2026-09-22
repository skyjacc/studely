-- The register has to tell a student WHY a link could not be confirmed:
-- "Provider blocks automated checks (Sep 21)" is a different fact from
-- "Link checked Sep 21", and printing the second when the first is true is the
-- kind of quiet lie the whole trust model exists to prevent.
--
-- link_checks holds that fact, but it is staff-only by design (0001: "internal
-- noise") and the public site builds with the anon key. Rather than open the
-- table, offers carries a projection of its own LATEST automated check:
--
--     last_checked        when
--     last_check_result   pass | warn | fail
--     last_check_note     blocked | unreachable   (only meaningful for warn)
--
-- The note is a closed code, not the checker's prose: presentation turns it
-- into words (trust.ts → StateBadge), so the wording can change without a
-- migration and a raw error string can never reach a page.

-- ---------------------------------------------------------------- link_checks

-- Keep the classification on the internal row too, so the projection can always
-- be rebuilt from history.
alter table public.link_checks
  add column if not exists note text
    check (note is null or note in ('blocked', 'unreachable'));

-- ---------------------------------------------------------------- offers

alter table public.offers
  add column if not exists last_check_result check_result,
  add column if not exists last_check_note text
    check (last_check_note is null or last_check_note in ('blocked', 'unreachable'));

comment on column public.offers.last_check_result is
  'Result of the LATEST automated link check (projection of link_checks). Never a human verification.';
comment on column public.offers.last_check_note is
  'Why the latest check could not confirm the page: blocked | unreachable. Null unless the result is warn.';

-- Backfill: strictly the latest row per offer (checked_at, then id as the
-- tie-break), so a re-run cannot pick a different check. The note is derived
-- once here from what the old rows recorded — from now on the checker sends it.
with latest as (
  select distinct on (offer_id)
         offer_id, result, status_code, error, checked_at
    from public.link_checks
   order by offer_id, checked_at desc, id desc
)
update public.offers o
   set last_check_result = latest.result,
       last_check_note = case
         when latest.result <> 'warn' then null
         when latest.error is not null then 'unreachable'
         when latest.status_code in (401, 403, 405, 406, 429) then 'blocked'
         else null
       end
  from latest
 where latest.offer_id = o.id;

-- Same derivation for the historical rows, so the two agree.
update public.link_checks
   set note = case
     when result <> 'warn' then null
     when error is not null then 'unreachable'
     when status_code in (401, 403, 405, 406, 429) then 'blocked'
     else null
   end
 where note is null and result = 'warn';

-- ---------------------------------------------------------------- the writer

-- One statement per check writes the row and the projection, so last_checked,
-- last_check_result and last_check_note always describe the SAME check.
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

    if item_note is not null and item_note not in ('blocked', 'unreachable') then
      raise exception 'unknown check note: %', item_note using errcode = '22023';
    end if;

    if not exists (select 1 from public.offers where id = target_id) then
      raise exception 'offer not found: %', target_id using errcode = '23503';
    end if;

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

    update public.offers
       set last_checked = item_checked,
           last_check_result = item_result,
           last_check_note = item_note,
           status = target_status
     where id = target_id;

    written := written + 1;
  end loop;

  return written;
end $$;

revoke all on function public.record_link_check_batch(jsonb)
  from anon, authenticated, service_role, public;
grant execute on function public.record_link_check_batch(jsonb) to service_role;
