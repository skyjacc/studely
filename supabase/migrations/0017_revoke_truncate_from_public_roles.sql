-- SECURITY. Found while opening the check history (0015/0016): every table in
-- the public schema still carried the blanket grants it was created with, and
-- those include TRUNCATE for `anon` and `authenticated`.
--
-- Row Level Security does not apply to TRUNCATE. It filters SELECT, INSERT,
-- UPDATE and DELETE; TRUNCATE is allowed by the privilege alone. So the anon
-- key — which is published in the site's own client bundle, as it is designed
-- to be — was one statement away from emptying offers, offer_attributes,
-- verifications, categories, comments, submissions and offer_clicks. The RLS
-- policies this project relies on never saw it coming, because they are not
-- consulted.
--
-- Demonstrated as `anon` inside a rolled-back transaction before this ran:
-- `truncate public.submissions` succeeded. After it: insufficient_privilege.
--
-- Nothing in the application truncates anything (no occurrence in src/ or
-- scripts/), so this takes away a capability neither role has ever used.
-- TRIGGER and REFERENCES go too: creating triggers or foreign keys against
-- these tables is not a visitor's job either.
--
-- The remaining INSERT/UPDATE/DELETE grants to anon are a separate question —
-- RLS *does* cover those, and narrowing them needs a per-table audit of what
-- the site and the admin actually write. Raised for its own change.

do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('revoke truncate, trigger, references on public.%I from anon, authenticated', t.tablename);
  end loop;
end $$;

-- and stop the defaults from handing it back to the next table created
alter default privileges in schema public revoke truncate, trigger, references on tables from anon, authenticated;
