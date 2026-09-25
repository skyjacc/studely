# Verifying the latest-check projection (migrations 0013 + 0014)

`offers.last_checked` / `last_check_result` / `last_check_note` are a projection
of the offer's newest row in `link_checks`. The register prints them, so their
invariants have to hold against the database, not against the good behaviour of
the one writer we happen to have today:

1. the three columns describe the **same** check;
2. `note` exists only on a `warn`;
3. the projection **never moves backwards**, however a batch is replayed.

CI cannot prove these — there is no Postgres in the workflow, and adding a
Supabase branch costs money this project does not have yet. `projection.test.ts`
guards the *rules* (the named constraints and the RPC's guard must stay in the
migrations); this file is how the *behaviour* is proven, against the real
database, without leaving anything behind.

## The method

One `DO` block runs every case inside a single transaction and ends with a
deliberate `raise exception`, which aborts it. Nothing is committed: the block
reports its results through the error message. Run it with the Supabase SQL
editor or MCP `execute_sql`.

Read the result as: `PASS: <cases that held> | FAIL: none`.

## Cases

| # | Case | Expected |
|---|---|---|
| 1 | `warn` + `blocked` | stored as sent |
| 2 | `warn` + `unreachable` | stored as sent |
| 3 | `pass`, no note | `last_check_note` null |
| 4 | `fail`, no note | null note, `status` demoted to `unverified` |
| 5 | projection vs newest history row | `result`, `note`, `checked_at` all agree |
| 6 | `pass` + `blocked` through the RPC | refused, readable error |
| 7 | `pass` + `blocked` by direct UPDATE | refused by `offers_note_matches_check_result` |
| 8 | a batch older than the projection | recorded in `link_checks`, projection unmoved |
| 9 | a batch with the same `checked_at` | applies (a re-run is idempotent, not refused) |

## Last run

2026-09-25, against `myehxcjcdjxjysoeiynq` (production), on migration 0014:

```text
ROLLBACK (intentional) | PASS: warn+blocked · warn+unreachable · pass+null ·
fail+null · projection=latest-history · rpc refuses pass+blocked ·
constraint refuses pass+blocked · stale ignored by projection ·
stale kept in history · equal timestamp applies | FAIL: none
```

Production was unchanged afterwards: 42 `link_checks` rows, 4 warns, 0 offers
off `active`, and all 14 projections still equal to their newest history row.

## The block

```sql
do $$
declare
  t uuid; base timestamptz; got record; errs text[] := '{}'; oks text[] := '{}'; n integer;
begin
  select id, last_checked into t, base from public.offers where slug = 'github-student-pack';

  perform public.record_link_check_batch(jsonb_build_array(
    jsonb_build_object('offer_id', t, 'ok', true, 'result', 'warn', 'note', 'blocked', 'status_code', 403, 'offer_status', 'active', 'checked_at', base + interval '1 day')));
  select last_check_result::text a, last_check_note b into got from public.offers where id = t;
  if (got.a, got.b) = ('warn','blocked') then oks := oks || array['warn+blocked']; else errs := errs || array[format('warn+blocked got %s/%s', got.a, got.b)]; end if;

  perform public.record_link_check_batch(jsonb_build_array(
    jsonb_build_object('offer_id', t, 'ok', true, 'result', 'warn', 'note', 'unreachable', 'error', 'timeout', 'offer_status', 'active', 'checked_at', base + interval '2 day')));
  select last_check_result::text a, last_check_note b into got from public.offers where id = t;
  if (got.a, got.b) = ('warn','unreachable') then oks := oks || array['warn+unreachable']; else errs := errs || array['warn+unreachable']; end if;

  perform public.record_link_check_batch(jsonb_build_array(
    jsonb_build_object('offer_id', t, 'ok', true, 'result', 'pass', 'status_code', 200, 'offer_status', 'active', 'checked_at', base + interval '3 day')));
  select last_check_result::text a, last_check_note b into got from public.offers where id = t;
  if got.a = 'pass' and got.b is null then oks := oks || array['pass+null']; else errs := errs || array['pass+null']; end if;

  perform public.record_link_check_batch(jsonb_build_array(
    jsonb_build_object('offer_id', t, 'ok', false, 'result', 'fail', 'status_code', 500, 'offer_status', 'unverified', 'checked_at', base + interval '4 day')));
  select last_check_result::text a, last_check_note b, status::text c into got from public.offers where id = t;
  if got.a = 'fail' and got.b is null and got.c = 'unverified' then oks := oks || array['fail+null']; else errs := errs || array['fail+null']; end if;

  select l.result::text a, l.note b, l.checked_at c into got
    from public.link_checks l where l.offer_id = t order by l.checked_at desc, l.id desc limit 1;
  if exists (select 1 from public.offers o where o.id = t and o.last_check_result::text = got.a
             and o.last_check_note is not distinct from got.b and o.last_checked = got.c)
    then oks := oks || array['projection=latest-history']; else errs := errs || array['projection=latest-history']; end if;

  begin
    perform public.record_link_check_batch(jsonb_build_array(
      jsonb_build_object('offer_id', t, 'ok', true, 'result', 'pass', 'note', 'blocked', 'offer_status', 'active', 'checked_at', base + interval '5 day')));
    errs := errs || array['pass+blocked was accepted'];
  exception when others then oks := oks || array['rpc refuses pass+blocked']; end;

  begin
    update public.offers set last_check_result = 'pass', last_check_note = 'blocked' where id = t;
    errs := errs || array['direct pass+blocked was accepted'];
  exception when check_violation then oks := oks || array['constraint refuses pass+blocked']; end;

  select count(*) into n from public.link_checks where offer_id = t;
  perform public.record_link_check_batch(jsonb_build_array(
    jsonb_build_object('offer_id', t, 'ok', true, 'result', 'warn', 'note', 'blocked', 'status_code', 403, 'offer_status', 'active', 'checked_at', base - interval '10 day')));
  select last_check_result::text a, last_checked b into got from public.offers where id = t;
  if got.a = 'fail' and got.b = base + interval '4 day' then oks := oks || array['stale ignored by projection']; else errs := errs || array[format('stale moved projection to %s/%s', got.a, got.b)]; end if;
  if (select count(*) from public.link_checks where offer_id = t) = n + 1
    then oks := oks || array['stale kept in history']; else errs := errs || array['stale lost from history']; end if;

  perform public.record_link_check_batch(jsonb_build_array(
    jsonb_build_object('offer_id', t, 'ok', true, 'result', 'pass', 'status_code', 200, 'offer_status', 'active', 'checked_at', base + interval '4 day')));
  select last_check_result::text a into got from public.offers where id = t;
  if got.a = 'pass' then oks := oks || array['equal timestamp applies']; else errs := errs || array['equal timestamp refused']; end if;

  raise exception 'ROLLBACK (intentional) | PASS: % | FAIL: %', array_to_string(oks, ' · '), coalesce(nullif(array_to_string(errs, ' · '), ''), 'none');
end $$;
```

## When to re-run it

After any migration that touches `link_checks`, `offers.last_check_*` or
`record_link_check_batch` — and paste the new result line above.

---

# Verifying the public check surface (0015 · 0016 · 0017)

The record shows a dated history, so `link_checks` had to become readable — but
only its published facts, and only for published offers. Two things were learned
doing it, and both are worth re-checking after any grant or policy change.

## What the rules are

| Role | May read | May not read | May write |
|---|---|---|---|
| `anon`, `authenticated` | `offer_id`, `checked_at`, `result`, `note` — for published offers | `ok`, `status_code`, `error`, `final_url`, `id` | nothing |
| `service_role` | everything | — | through `record_link_check_batch` only |

## Why a column grant was not enough

Postgres takes the **union** of table-level and column-level privileges. This
database was created with blanket grants (`SELECT/INSERT/UPDATE/DELETE/TRUNCATE`)
to `anon` and `authenticated` on every public table, held back only by RLS. So
0015's column grant changed nothing on its own: the moment its read policy
allowed the rows, every column came with them. 0016 revokes the blanket grant
first, which is what makes the column list real.

## Why TRUNCATE was the serious one

**RLS does not apply to TRUNCATE.** It filters SELECT, INSERT, UPDATE and DELETE;
TRUNCATE is permitted by the privilege alone. With `anon` holding it on every
table — and the anon key published in the site's client bundle by design — the
whole register could have been emptied by a single statement, with every policy
in this project intact and irrelevant. 0017 revokes it everywhere (plus TRIGGER
and REFERENCES) and changes the schema's default privileges so new tables do not
inherit it.

## The block

Run as the `anon` role inside a transaction that ends in a deliberate `raise`,
so nothing is committed.

```sql
do $$
declare oks text[] := '{}'; errs text[] := '{}'; t record; n integer;
begin
  set local role anon;

  -- 1. the four published facts are readable, the diagnostics are not
  begin perform offer_id, checked_at, result, note from public.link_checks limit 1;
    oks := oks || array['four public columns readable'];
  exception when others then errs := errs || array['public columns blocked']; end;
  begin perform error from public.link_checks limit 1; errs := errs || array['error READABLE'];
  exception when insufficient_privilege then oks := oks || array['error blocked']; end;
  begin perform status_code from public.link_checks limit 1; errs := errs || array['status_code READABLE'];
  exception when insufficient_privilege then oks := oks || array['status_code blocked']; end;
  begin perform final_url from public.link_checks limit 1; errs := errs || array['final_url READABLE'];
  exception when insufficient_privilege then oks := oks || array['final_url blocked']; end;
  begin perform * from public.link_checks limit 1; errs := errs || array['select * READABLE'];
  exception when insufficient_privilege then oks := oks || array['select * blocked']; end;

  -- 2. nothing public writes a check
  begin
    insert into public.link_checks (offer_id, ok, result, checked_at)
      select id, true, 'pass', now() from public.offers limit 1;
    errs := errs || array['anon can INSERT'];
  exception when others then oks := oks || array['insert refused']; end;

  -- 3. no table in the schema can be truncated
  for t in select tablename from pg_tables where schemaname='public' order by tablename
  loop
    begin
      execute format('truncate public.%I', t.tablename);
      errs := errs || array[t.tablename || ' STILL TRUNCATABLE'];
    exception when insufficient_privilege then oks := oks || array['no truncate: ' || t.tablename];
              when others then oks := oks || array['no truncate: ' || t.tablename]; end;
  end loop;

  -- 4. the site still reads what it renders
  select count(*) into n from public.offers where visibility = 'published';
  oks := oks || array[format('offers readable: %s', n)];
  select count(*) into n from public.link_checks;
  oks := oks || array[format('checks readable: %s', n)];

  reset role;
  raise exception 'ROLLBACK (intentional) | PASS: % | FAIL: %',
    array_to_string(oks, ' · '), coalesce(nullif(array_to_string(errs, ' · '), ''), 'none');
end $$;
```

## Last run

2026-09-25, against `myehxcjcdjxjysoeiynq` (production), after 0017:

```text
PASS: four public columns readable · error blocked · status_code blocked ·
final_url blocked · select * blocked · insert refused ·
no truncate: categories, comments, link_checks, offer_attributes, offer_clicks,
offers, profiles, submissions, verifications ·
offers readable: 14 · checks readable: 56 | FAIL: none
```

## Still open

`anon` keeps table-level INSERT/UPDATE/DELETE on most public tables. RLS *does*
cover those, and today no policy lets an anonymous visitor through — but the
grants are wider than the app needs. Narrowing them requires a per-table audit
of what the site and the admin actually write, and belongs to its own change.
