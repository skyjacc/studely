-- Narrow the write privileges held by the public roles to the write paths the
-- application actually has.
--
-- Companion to 0017/0018, which took away what RLS cannot police (TRUNCATE,
-- TRIGGER, REFERENCES) and are already applied to the database. This is the
-- other half: `anon` and `authenticated` still hold table-wide
-- INSERT/UPDATE/DELETE on every table, inherited from the project's creation.
-- RLS *does* police those, and no policy lets an anonymous visitor write today
-- — so this closes no open hole. It removes the standing invitation: with the
-- grants this wide, one careless policy is all that separates the public from
-- the register, and a reviewer reading the grants cannot tell intent from
-- inheritance.
--
-- Audited against src/ (2026-09-25):
--
--   /go/<slug>            createSupabaseBuild → anon
--                         offer_clicks INSERT          (clicks.ts)
--   admin actions         createSupabaseServer → authenticated
--                         offers INSERT/UPDATE/DELETE  (admin-offers.ts)
--                         offer_attributes DELETE then INSERT
--                         update_offer_with_attributes is SECURITY INVOKER,
--                         so it needs the caller's own grants
--   categories            read only; no write path exists
--   comments              RLS anticipates one; no write path exists
--   submissions           RLS allows a public insert, but the site's "suggest a
--                         deal" route is a mailto: link — no path exists
--   verifications         written by the checker through a service-role RPC
--   link_checks           service-role only (0016, applied)
--   profiles              staff identities; nothing in src/ writes them, yet
--                         `authenticated` held DELETE
--   offer_ratings         an aggregate view (GROUP BY, no rules, no triggers),
--                         so it was never writable whatever the grant said —
--                         included so the catalog can be asserted at all
--
-- offer_attributes gets INSERT and DELETE but NOT UPDATE: the admin replaces an
-- offer's attributes wholesale rather than editing a row in place.
--
-- A grant removed here is not a decision about the feature. When the
-- verification recorder (P1.3) or a real submission form lands, it adds the one
-- grant it needs, and the diff says which capability arrived with it.
--
-- Grants only. No RLS policy is touched.

revoke insert, update, delete on
  public.categories,
  public.comments,
  public.offer_attributes,
  public.offer_clicks,
  public.offer_ratings,
  public.offers,
  public.profiles,
  public.submissions,
  public.verifications
from anon, authenticated;

-- the tracked exit logs a click as the visitor
grant insert on public.offer_clicks to anon, authenticated;

-- the admin edits the register as itself, under private.is_staff()
grant insert, update, delete on public.offers to authenticated;
grant insert, delete on public.offer_attributes to authenticated;
