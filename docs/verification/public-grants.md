# Verifying the public write grants (migration 0019)

`anon` and `authenticated` were created with table-wide INSERT/UPDATE/DELETE on
every table in the public schema. RLS covers those verbs and no policy lets an
anonymous visitor write today, so this is not an open hole — it is standing
permission for paths that do not exist. 0019 narrows the grants to the write
paths the application actually has.

This is grants only. No RLS policy is touched, and SELECT is left alone.

## The allow-list

| Role | Table | May write |
|---|---|---|
| `anon` | `offer_clicks` | INSERT |
| `authenticated` | `offers` | INSERT, UPDATE, DELETE |
| `authenticated` | `offer_attributes` | INSERT, DELETE |
| `authenticated` | `offer_clicks` | INSERT |

Everything else: nothing. `offer_attributes` gets no UPDATE — the admin replaces
an offer's attributes wholesale (`admin-offers.ts`: delete, then insert).

Held in CI by `src/domain/security/public-grants.test.ts`, which reads the
migration ledger and fails on any write grant outside this list.

## The block

It applies 0019 inside the transaction and ends with a deliberate `raise`, so
the database is unchanged either way — which means it can be run **before**
the migration to see what the state is, and after it to confirm.

Catalog checks use `has_table_privilege`, which answers about the grant alone;
RLS cannot mask it either way. The one path that must keep working end to end is
proven with a real row rather than a `where false` query that touches nothing.

```sql
do $$
declare oks text[] := '{}'; errs text[] := '{}'; target uuid; target_slug text; n integer; verb text; r record;
  expect_grant text[] := array[
    'anon:offer_clicks:INSERT',
    'authenticated:offers:INSERT','authenticated:offers:UPDATE','authenticated:offers:DELETE',
    'authenticated:offer_attributes:INSERT','authenticated:offer_attributes:DELETE',
    'authenticated:offer_clicks:INSERT'];
begin
  revoke insert, update, delete on
    public.categories, public.comments, public.offer_attributes, public.offer_clicks,
    public.offer_ratings, public.offers, public.profiles, public.submissions, public.verifications
  from anon, authenticated;
  grant insert on public.offer_clicks to anon, authenticated;
  grant insert, update, delete on public.offers to authenticated;
  grant insert, delete on public.offer_attributes to authenticated;

  for r in
    select grantee, table_name, privilege_type from information_schema.table_privileges
     where table_schema='public' and grantee in ('anon','authenticated')
       and privilege_type in ('INSERT','UPDATE','DELETE')
  loop
    if not (format('%s:%s:%s', r.grantee, r.table_name, r.privilege_type) = any(expect_grant)) then
      errs := errs || array[format('unexpected %s %s on %s', r.grantee, r.privilege_type, r.table_name)];
    end if;
  end loop;
  select count(*) into n from information_schema.table_privileges
   where table_schema='public' and grantee in ('anon','authenticated')
     and privilege_type in ('INSERT','UPDATE','DELETE');
  if n = array_length(expect_grant, 1) then oks := oks || array[format('catalog = allow-list (%s)', n)];
  else errs := errs || array[format('catalog %s vs allow-list %s', n, array_length(expect_grant,1))]; end if;

  select id, slug into target, target_slug from public.offers where visibility='published' limit 1;

  set local role anon;
  begin
    insert into public.offer_clicks (offer_id, slug, source) values (target, target_slug, 'grant-audit');
    oks := oks || array['anon logs a real click'];
  exception when others then errs := errs || array['anon click failed: ' || left(SQLERRM,40)]; end;
  begin insert into public.submissions (url) values ('https://example.test'); errs := errs || array['anon inserts submissions'];
  exception when insufficient_privilege then oks := oks || array['anon submission refused']; end;
  begin update public.offers set title = title where id = target; errs := errs || array['anon updates offers'];
  exception when insufficient_privilege then oks := oks || array['anon offer update refused']; end;
  begin delete from public.profiles; errs := errs || array['anon deletes profiles'];
  exception when insufficient_privilege then oks := oks || array['anon profile delete refused']; end;
  select count(*) into n from public.offers where visibility='published';
  oks := oks || array[format('anon reads %s offers', n)];
  reset role;

  set local role authenticated;
  begin delete from public.profiles; errs := errs || array['authenticated deletes profiles'];
  exception when insufficient_privilege then oks := oks || array['authenticated profile delete refused'];
            when others then errs := errs || array['authenticated profile delete only blocked by RLS']; end;
  reset role;

  foreach verb in array array['INSERT','UPDATE','DELETE'] loop
    if has_table_privilege('authenticated','public.offers',verb) then oks := oks || array['admin offers ' || verb];
    else errs := errs || array['admin LOST offers ' || verb]; end if;
  end loop;
  foreach verb in array array['INSERT','DELETE'] loop
    if has_table_privilege('authenticated','public.offer_attributes',verb) then oks := oks || array['admin attrs ' || verb];
    else errs := errs || array['admin LOST attrs ' || verb]; end if;
  end loop;
  if has_table_privilege('authenticated','public.offer_attributes','UPDATE')
    then errs := errs || array['attrs UPDATE present']; else oks := oks || array['attrs UPDATE absent, as intended']; end if;

  raise exception 'ROLLBACK (intentional) | PASS: % | FAIL: %',
    array_to_string(oks, ' · '), coalesce(nullif(array_to_string(errs, ' · '), ''), 'none');
end $$;
```

## Last run

2026-09-25, against `myehxcjcdjxjysoeiynq` (production), with 0019 applied
inside the rolled-back transaction:

```text
PASS: catalog = allow-list (7) · anon logs a real click · anon submission refused ·
anon offer update refused · anon profile delete refused · anon reads 14 offers ·
authenticated profile delete refused · admin offers INSERT · admin offers UPDATE ·
admin offers DELETE · admin attrs INSERT · admin attrs DELETE ·
attrs UPDATE absent, as intended | FAIL: none
```

Two tables the first pass of this audit missed, found by the catalog check
rather than by reading the code:

- **`profiles`** — `authenticated` held DELETE. Staff identities, and nothing in
  `src/` writes them.
- **`offer_ratings`** — both roles held all three. It is an aggregate view
  (`GROUP BY`, no rules, no triggers), so it was never writable whatever the
  grant said; it is included so the catalog assertion can be exact.

## After applying it

Re-run the block against the real state (delete the `revoke`/`grant` lines at
the top, keep the checks) and expect the same `FAIL: none`. Then exercise the
two paths that must still work in the app itself: a `/go/<slug>` click writes an
`offer_clicks` row, and the admin can create, edit and unpublish an offer.
