-- 0006 — Sprint 1, Revenue Foundation: affiliate URL model + click tracking.
--
-- The public "Get this offer" links now point at /go/<slug>, which logs a click
-- and 302s to the affiliate destination. This is the foundation for CTR, Offer
-- ROI and swapping partner links without touching content.

-- Affiliate URL model on offers. Only affiliate_url is used today; the rest are
-- laid in now so the schema does not change when tracking/campaigns are wired.
alter table offers
  add column if not exists affiliate_url     text,
  add column if not exists fallback_url      text,
  add column if not exists tracking_source   text,
  add column if not exists tracking_campaign text;

comment on column offers.affiliate_url is
  '/go redirects here when set; otherwise it falls back to url, then fallback_url.';

-- Durable click log — one row per /go hit. Joinable with offers for Offer ROI.
create table if not exists offer_clicks (
  id         uuid primary key default gen_random_uuid(),
  offer_id   uuid not null references offers(id) on delete cascade,
  slug       text not null,
  source     text,
  referrer   text,
  created_at timestamptz not null default now()
);
create index if not exists offer_clicks_offer_idx   on offer_clicks (offer_id, created_at desc);
create index if not exists offer_clicks_created_idx on offer_clicks (created_at);

alter table offer_clicks enable row level security;

-- Anyone may log a click (public conversion tracking). Nobody but staff may read
-- them back. Abuse/rate-limiting is a later concern (see FOUNDATION: no infra
-- before it earns its keep). is_staff() lives in the private schema (0005).
drop policy if exists clicks_insert on offer_clicks;
drop policy if exists clicks_staff  on offer_clicks;
create policy clicks_insert on offer_clicks for insert with check (true);
create policy clicks_staff  on offer_clicks for all    using (private.is_staff()) with check (private.is_staff());

grant insert on offer_clicks to anon, authenticated;
grant select on offer_clicks to authenticated;
