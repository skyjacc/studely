-- 0009 — the score must always be earned, never inherited.
--
-- Two ways an offer could carry points no reason accounts for:
--
--   1. offers.score defaulted to 7. A freshly inserted offer with no attributes
--      showed 7/10 while its "Why this score" breakdown was empty — the exact
--      thing the score promises never to be. Base is 5 (0001's recompute
--      formula), so 5 is the only honest starting value.
--
--   2. update_offer_with_attributes relied on the per-row rescore trigger. Saving
--      an offer that has no attributes and gets none deletes 0 rows and inserts
--      0 rows, so the FOR EACH ROW trigger never fires and the stale score
--      survives the save. Recompute in the RPC instead: it runs on every save,
--      whatever the row counts, and stays inside the same transaction.
--
-- Idempotent. No backfill: every current offer already matches its attributes
-- (checked before writing this), so nothing needs correcting.

alter table public.offers alter column score set default 5;

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

  -- Recompute unconditionally — same formula as recompute_offer_score(), but not
  -- dependent on any row actually changing. With no attributes this settles at
  -- the base 5 rather than leaving whatever the offer happened to carry.
  update public.offers o
     set score = greatest(1, least(10, 5 + coalesce((
           select sum(a.points) from public.offer_attributes a where a.offer_id = target_id
         ), 0)))
   where o.id = target_id
   returning o.score into final_score;

  return final_score;
end $$;

revoke all on function public.update_offer_with_attributes(text, jsonb, jsonb)
  from anon, authenticated, public;
grant execute on function public.update_offer_with_attributes(text, jsonb, jsonb)
  to authenticated;
