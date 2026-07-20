-- Claimly — foundation schema.
--
-- Design notes (deliberate departures from the old markdown frontmatter):
--   * `expires` was the text "ongoing" or an ISO date. Here it is `expires_at date`
--     with NULL meaning "ongoing", so the re-check cron can actually query for
--     offers that are expiring. Text could never be compared.
--   * `score` is no longer typed by hand. It is derived from `offer_attributes`
--     (the kycnot.me model: every point is attributable) and kept in a stored
--     column by trigger, so the static build stays one fast query.
--   * `status` (offer health) and `visibility` (editorial state) are separate.
--     An offer can be published-but-expired, or active-but-still-a-draft.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- enums

create type offer_type    as enum ('free', 'discount', 'credit', 'trial');
create type offer_status  as enum ('active', 'expiring', 'expired', 'unverified');
create type visibility    as enum ('draft', 'published', 'archived');
create type user_role     as enum ('user', 'moderator', 'admin');
create type moderation    as enum ('pending', 'published', 'rejected', 'spam');
create type submission_status as enum ('pending', 'approved', 'rejected', 'duplicate');
create type check_result  as enum ('pass', 'fail', 'warn');

-- ---------------------------------------------------------------- helpers

create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------- profiles

-- Mirrors auth.users. `trust` weights this account's rating contribution, so a
-- brand-new single-review account cannot swing an offer's score.
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  handle      text unique not null,
  role        user_role not null default 'user',
  trust       numeric(4,2) not null default 1.00 check (trust >= 0 and trust <= 5),
  is_banned   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger profiles_updated before update on profiles
  for each row execute function set_updated_at();

create or replace function is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role in ('moderator', 'admin') and not is_banned
  );
$$;

-- ---------------------------------------------------------------- categories

create table categories (
  slug        text primary key,
  name        text not null,
  description text not null,
  accent      text not null,
  position    int  not null default 0,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------- offers

create table offers (
  id               uuid primary key default gen_random_uuid(),
  slug             text unique not null,
  title            text not null,
  provider         text not null,
  category         text not null references categories(slug) on update cascade,
  summary          text not null,
  value            text not null,
  body             text not null default '',

  offer_type       offer_type not null,
  discount_percent int check (discount_percent between 1 and 100),

  url              text not null,
  affiliate        boolean not null default false,
  sponsored        boolean not null default false,
  featured         boolean not null default false,

  verification     text not null,
  eligibility      text not null default 'Verified students worldwide',
  tags             text[] not null default '{}',

  -- derived from offer_attributes by trigger; never edited directly
  score            int not null default 7 check (score between 1 and 10),

  status           offer_status not null default 'active',
  visibility       visibility   not null default 'draft',

  expires_at       date,              -- NULL = ongoing
  last_checked     timestamptz not null default now(),

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  created_by       uuid references profiles(id) on delete set null,

  -- a discount offer should carry its percentage; other types should not
  constraint discount_pct_only_for_discounts check (
    (offer_type = 'discount') or (discount_percent is null)
  )
);
create trigger offers_updated before update on offers
  for each row execute function set_updated_at();

create index offers_live_idx    on offers (visibility, status);
create index offers_category_idx on offers (category);
create index offers_expiry_idx  on offers (expires_at) where expires_at is not null;
create index offers_tags_idx    on offers using gin (tags);

-- ------------------------------------------------- scoring (kycnot.me model)

-- Every point in an offer's score is attributable to a named, visible reason.
-- "Score: 9" alone is unfalsifiable; "no card required +2, full Pro tier +3" is not.
create table offer_attributes (
  id         uuid primary key default gen_random_uuid(),
  offer_id   uuid not null references offers(id) on delete cascade,
  key        text not null,           -- 'no_card_required', 'renewable', ...
  label      text not null,           -- human copy shown on the offer page
  points     int  not null,           -- may be negative
  created_at timestamptz not null default now(),
  unique (offer_id, key)
);
create index offer_attributes_offer_idx on offer_attributes (offer_id);

-- Recompute the stored score whenever attributes change. Base 5, clamped 1..10.
create or replace function recompute_offer_score() returns trigger
language plpgsql as $$
declare
  target uuid := coalesce(new.offer_id, old.offer_id);
  total  int;
begin
  select coalesce(sum(points), 0) into total
    from offer_attributes where offer_id = target;
  update offers
     set score = greatest(1, least(10, 5 + total))
   where id = target;
  return null;
end $$;

create trigger offer_attributes_rescore
after insert or update or delete on offer_attributes
for each row execute function recompute_offer_score();

-- ------------------------------------------------- verification evidence

-- kycnot.me shows *proof* a check happened, not just a claim. Same here: who
-- checked, when, what the result was, and a link to the screenshot.
create table verifications (
  id           uuid primary key default gen_random_uuid(),
  offer_id     uuid not null references offers(id) on delete cascade,
  result       check_result not null,
  note         text,
  evidence_url text,
  checked_by   uuid references profiles(id) on delete set null,
  checked_at   timestamptz not null default now()
);
create index verifications_offer_idx on verifications (offer_id, checked_at desc);

-- Automated cron output, kept separate from human verification.
create table link_checks (
  id          uuid primary key default gen_random_uuid(),
  offer_id    uuid not null references offers(id) on delete cascade,
  ok          boolean not null,
  status_code int,
  error       text,
  checked_at  timestamptz not null default now()
);
create index link_checks_offer_idx on link_checks (offer_id, checked_at desc);

-- ---------------------------------------------------------------- submissions

-- Public "suggest a deal" queue. Anyone may submit; nothing goes live without a
-- human approving it, which is what the site promises on the pipeline section.
create table submissions (
  id           uuid primary key default gen_random_uuid(),
  url          text not null,
  title        text,
  note         text,
  category     text references categories(slug) on update cascade,
  submitted_by uuid references profiles(id) on delete set null,
  email        text,                  -- for anonymous submitters
  status       submission_status not null default 'pending',
  review_note  text,
  reviewed_by  uuid references profiles(id) on delete set null,
  reviewed_at  timestamptz,
  offer_id     uuid references offers(id) on delete set null,  -- set when approved
  created_at   timestamptz not null default now()
);
create index submissions_queue_idx on submissions (status, created_at desc);

-- ---------------------------------------------------------------- comments

-- Hybrid model: anyone reads, only signed-in accounts write, and a newcomer's
-- first posts sit in `pending` until a moderator clears them.
create table comments (
  id          uuid primary key default gen_random_uuid(),
  offer_id    uuid not null references offers(id) on delete cascade,
  author_id   uuid not null references profiles(id) on delete cascade,
  rating      int check (rating between 1 and 5),
  body        text not null check (char_length(body) between 2 and 4000),
  -- author confirmed they actually redeemed this (kycnot's "Order ID checked")
  claimed     boolean not null default false,
  status      moderation not null default 'pending',
  mod_note    text,
  moderated_by uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger comments_updated before update on comments
  for each row execute function set_updated_at();

create index comments_offer_idx on comments (offer_id, status, created_at desc);
create index comments_queue_idx on comments (status, created_at desc);

-- Raw average is trivially gamed; the weighted average discounts low-trust
-- accounts. Both are exposed so the page can show them side by side.
create view offer_ratings as
select
  o.id                                          as offer_id,
  count(c.id)                                   as rating_count,
  round(avg(c.rating)::numeric, 2)              as rating_avg,
  round(
    (sum(c.rating * p.trust) / nullif(sum(p.trust), 0))::numeric, 2
  )                                             as rating_weighted
from offers o
left join comments c
  on c.offer_id = o.id and c.status = 'published' and c.rating is not null
left join profiles p on p.id = c.author_id
group by o.id;

-- ---------------------------------------------------------------- RLS

alter table profiles         enable row level security;
alter table categories       enable row level security;
alter table offers           enable row level security;
alter table offer_attributes enable row level security;
alter table verifications    enable row level security;
alter table link_checks      enable row level security;
alter table submissions      enable row level security;
alter table comments         enable row level security;

-- profiles: public read, self-update, staff manage
create policy profiles_read   on profiles for select using (true);
create policy profiles_update on profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_staff  on profiles for all    using (is_staff()) with check (is_staff());

-- categories: public read, staff write
create policy categories_read  on categories for select using (true);
create policy categories_staff on categories for all    using (is_staff()) with check (is_staff());

-- offers: the world sees published rows only; staff see and edit everything
create policy offers_read_published on offers for select using (visibility = 'published');
create policy offers_staff          on offers for all    using (is_staff()) with check (is_staff());

-- attributes / evidence follow their offer's visibility
create policy attrs_read  on offer_attributes for select
  using (exists (select 1 from offers o where o.id = offer_id and o.visibility = 'published'));
create policy attrs_staff on offer_attributes for all using (is_staff()) with check (is_staff());

create policy verif_read  on verifications for select
  using (exists (select 1 from offers o where o.id = offer_id and o.visibility = 'published'));
create policy verif_staff on verifications for all using (is_staff()) with check (is_staff());

-- link checks are internal noise, staff only
create policy checks_staff on link_checks for all using (is_staff()) with check (is_staff());

-- submissions: anyone may file one, submitters see their own, staff see the queue
create policy subs_insert on submissions for insert with check (true);
create policy subs_read_own on submissions for select using (submitted_by = auth.uid());
create policy subs_staff  on submissions for all using (is_staff()) with check (is_staff());

-- comments: published are public; signed-in accounts post as themselves and may
-- edit their own while it is still pending; staff moderate everything
create policy comments_read_published on comments for select using (status = 'published');
create policy comments_read_own       on comments for select using (author_id = auth.uid());
create policy comments_insert on comments for insert
  with check (
    author_id = auth.uid()
    and not exists (select 1 from profiles where id = auth.uid() and is_banned)
  );
create policy comments_update_own on comments for update
  using (author_id = auth.uid() and status = 'pending')
  with check (author_id = auth.uid());
create policy comments_staff on comments for all using (is_staff()) with check (is_staff());

-- A newcomer's first posts are held for review; established accounts publish
-- straight away. Clients cannot choose their own status — this decides it.
create or replace function set_comment_status() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  published_count int;
begin
  if is_staff() then
    new.status := coalesce(new.status, 'published');
    return new;
  end if;
  select count(*) into published_count
    from comments where author_id = new.author_id and status = 'published';
  new.status := case when published_count >= 3 then 'published' else 'pending' end;
  return new;
end $$;

create trigger comments_gate before insert on comments
for each row execute function set_comment_status();

-- ---------------------------------------------------------------- auth wiring

-- Signing up creates a row in auth.users but nothing in profiles, so every RLS
-- policy keyed on profiles would fail and even the owner could not reach /admin.
-- This keeps the two in step. New accounts are plain users; staff is granted by
-- updating the row, never by anything the client can send.
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, handle)
  values (
    new.id,
    coalesce(nullif(split_part(new.email, '@', 1), ''), 'user') || '-' || substr(new.id::text, 1, 6)
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function handle_new_user();
