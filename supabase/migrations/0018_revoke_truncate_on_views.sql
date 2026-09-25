-- 0017 swept `pg_tables`, which lists only ordinary tables. `offer_ratings` is a
-- view, so it kept TRUNCATE/TRIGGER/REFERENCES for anon and authenticated.
--
-- A view cannot be truncated — Postgres refuses with "is not a table" — so this
-- closes no hole on its own. It closes the *check*: the invariant we want to be
-- able to assert is "no public role holds one of these anywhere in the schema",
-- and one leftover row makes that assertion useless. Sweeping every relation
-- kind (tables, partitioned tables, views, materialised views, foreign tables)
-- is what makes the catalog query a real test rather than a partial one.

do $$
declare r record;
begin
  for r in
    select c.relname
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'f')
  loop
    execute format('revoke truncate, trigger, references on public.%I from anon, authenticated', r.relname);
  end loop;
end $$;

alter default privileges in schema public revoke truncate, trigger, references on tables from anon, authenticated;
