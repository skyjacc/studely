-- 0008 — Fix the automation RPC role guard from 0007.
--
-- record_link_check_batch is SECURITY DEFINER, so current_user is always the
-- function owner (`postgres`) inside the body. The 0007 comparison against
-- `service_role` therefore rejected the intended caller too.
--
-- Authorization belongs at the function boundary: EXECUTE is revoked from
-- PUBLIC/anon/authenticated and granted only to service_role. The function body
-- remains SECURITY DEFINER so the service-role API call can insert internal
-- link_checks and update offers without adding broad table grants.

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
  written integer := 0;
begin
  if jsonb_typeof(coalesce(checks, '[]'::jsonb)) <> 'array' then
    raise exception 'checks must be an array' using errcode = '22023';
  end if;

  for item in select value from jsonb_array_elements(coalesce(checks, '[]'::jsonb))
  loop
    target_id := (item->>'offer_id')::uuid;
    target_status := (item->>'offer_status')::offer_status;

    if not exists (select 1 from public.offers where id = target_id) then
      raise exception 'offer not found: %', target_id using errcode = '23503';
    end if;

    insert into public.link_checks (
      offer_id,
      ok,
      result,
      status_code,
      error,
      final_url,
      checked_at
    ) values (
      target_id,
      coalesce((item->>'ok')::boolean, false),
      (item->>'result')::check_result,
      case when item->>'status_code' is null then null else (item->>'status_code')::integer end,
      nullif(item->>'error', ''),
      nullif(item->>'final_url', ''),
      coalesce((item->>'checked_at')::timestamptz, now())
    );

    update public.offers
       set last_checked = coalesce((item->>'checked_at')::timestamptz, now()),
           status = target_status
     where id = target_id;

    written := written + 1;
  end loop;

  return written;
end $$;

revoke all on function public.record_link_check_batch(jsonb)
  from anon, authenticated, service_role, public;
grant execute on function public.record_link_check_batch(jsonb) to service_role;
