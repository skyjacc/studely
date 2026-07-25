-- 0007 — Operations hardening.
--
-- 1. Replace offer fields + score attributes atomically from the admin editor.
-- 2. Record one complete automated link-check batch atomically, then update each
--    offer's last_checked and health status from the classified result.

-- ------------------------------------------------ atomic offer editor save

create or replace function public.update_offer_with_attributes(
  offer_slug text,
  offer_patch jsonb,
  attribute_rows jsonb default '[]'::jsonb
) returns integer
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
declare
  target_id uuid;
  final_score integer;
begin
  if not private.is_staff() then
    raise exception 'admin access required' using errcode = '42501';
  end if;

  if jsonb_typeof(coalesce(attribute_rows, '[]'::jsonb)) <> 'array' then
    raise exception 'attribute_rows must be an array' using errcode = '22023';
  end if;

  update public.offers
     set title              = offer_patch->>'title',
         provider           = offer_patch->>'provider',
         category           = offer_patch->>'category',
         summary            = offer_patch->>'summary',
         value              = offer_patch->>'value',
         body               = coalesce(offer_patch->>'body', ''),
         offer_type         = (offer_patch->>'offer_type')::offer_type,
         discount_percent   = case
                                when offer_patch->'discount_percent' is null
                                  or offer_patch->>'discount_percent' = 'null'
                                then null
                                else (offer_patch->>'discount_percent')::integer
                              end,
         url                = offer_patch->>'url',
         affiliate          = coalesce((offer_patch->>'affiliate')::boolean, false),
         sponsored          = coalesce((offer_patch->>'sponsored')::boolean, false),
         featured           = coalesce((offer_patch->>'featured')::boolean, false),
         verification       = offer_patch->>'verification',
         eligibility        = offer_patch->>'eligibility',
         tags               = coalesce(
                                array(select jsonb_array_elements_text(offer_patch->'tags')),
                                '{}'::text[]
                              ),
         status             = (offer_patch->>'status')::offer_status,
         expires_at         = case
                                when offer_patch->'expires_at' is null
                                  or offer_patch->>'expires_at' = 'null'
                                  or offer_patch->>'expires_at' = ''
                                then null
                                else (offer_patch->>'expires_at')::date
                              end
   where slug = offer_slug
   returning id into target_id;

  if target_id is null then
    raise exception 'offer not found: %', offer_slug using errcode = 'P0002';
  end if;

  delete from public.offer_attributes where offer_id = target_id;

  insert into public.offer_attributes (offer_id, key, label, points)
  select target_id, row.key, row.label, row.points
    from jsonb_to_recordset(coalesce(attribute_rows, '[]'::jsonb))
      as row(key text, label text, points integer);

  select score into final_score from public.offers where id = target_id;
  return final_score;
end $$;

revoke all on function public.update_offer_with_attributes(text, jsonb, jsonb)
  from anon, authenticated, public;
grant execute on function public.update_offer_with_attributes(text, jsonb, jsonb)
  to authenticated;

-- ------------------------------------------------ automated verification batch

alter table public.link_checks
  add column if not exists result check_result,
  add column if not exists final_url text;

-- Backfill the richer result for old rows before enforcing it.
update public.link_checks
   set result = case when ok then 'pass'::check_result else 'fail'::check_result end
 where result is null;

alter table public.link_checks
  alter column result set not null;

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

-- NOTE: production briefly received an earlier 0007 body with an invalid
-- current_user guard. SECURITY DEFINER makes current_user the owner, so it also
-- rejected service_role. Migration 0008 repairs that applied history. Fresh
-- databases get the corrected body above and can still apply 0008 idempotently.
