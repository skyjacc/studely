-- 0012 — the write path gets one registry; the schema gets one word per meaning.
--
-- 1. offers.verification → offers.proof_method. The column has always held the
--    proof mechanism ("SheerID", "School email"); the word "verification" now
--    belongs only to the verifications table (human checks) and link_checks
--    (automated checks). Preflight on 2026-09-21: 14 rows, 0 empty values —
--    rename only, values untouched, NOT NULL kept.
-- 2. update_offer_with_attributes writes proof_method and affiliate_url.
--    affiliate_url has existed since 0006 but no write path reached it: the
--    editor could not set the one field the revenue path (/go) reads first.
--    src/domain/offers/offer-fields.test.ts now fails the build when the field
--    registry and this column list drift.
--
-- Idempotent on a fresh database; on production run it once.

alter table public.offers rename column verification to proof_method;
comment on column public.offers.proof_method is
  'How a student proves eligibility (SheerID, school email, ISIC…). Free text until a vocabulary lands.';

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
         affiliate_url      = nullif(offer_patch->>'affiliate_url', ''),
         proof_method       = offer_patch->>'proof_method',
         affiliate          = coalesce((offer_patch->>'affiliate')::boolean, false),
         sponsored          = coalesce((offer_patch->>'sponsored')::boolean, false),
         featured           = coalesce((offer_patch->>'featured')::boolean, false),
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

  -- Recompute unconditionally (same formula as recompute_offer_score()); with no
  -- attributes this settles at the base 5 rather than leaving a stale value.
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
