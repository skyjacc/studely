import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// The offers projection is a database contract, and the database — not the one
// well-behaved writer we happen to have — is what has to hold it. These read
// the migrations, so CI fails if a later one drops an invariant. The round-trip
// itself is proven against Postgres in a rolled-back transaction (see
// docs/verification/, referenced from the PR).

const DIR = join(process.cwd(), 'supabase/migrations');
/** Every migration concatenated in order: a later one may replace an earlier rule. */
const sql = readdirSync(DIR).sort().map((f) => readFileSync(join(DIR, f), 'utf8')).join('\n');
/** The last CREATE OR REPLACE of the checker RPC — the definition that is live. */
const rpc = sql.slice(sql.lastIndexOf('create or replace function public.record_link_check_batch'));

describe('the note belongs to a warn, and the database says so', () => {
  it('constrains note against result on link_checks and on the projection', () => {
    // named constraints, so the rule can be found (and this test kept honest)
    const constraint = (name: string) => {
      const at = sql.indexOf(`add constraint ${name}`);
      expect(at, `${name} must be created`).toBeGreaterThan(-1);
      return sql.slice(at, sql.indexOf(';', at));
    };
    // both columns in one rule is what makes `pass` + `blocked` impossible
    expect(constraint('link_checks_note_matches_result')).toMatch(/result[\s\S]*note/);
    expect(constraint('offers_note_matches_check_result')).toMatch(/last_check_result[\s\S]*last_check_note/);
  });

  it('refuses the inconsistent pair at the RPC boundary too, with a readable error', () => {
    expect(rpc).toMatch(/item_result <> 'warn'[\s\S]{0,200}?raise exception/);
  });
});

describe('what the public may read of a check', () => {
  // The record shows a dated history, so the check rows have to be readable —
  // but a link check is also an internal diagnostic. Published facts only:
  // when it ran and what it concluded. The diagnostic columns stay private,
  // and this test is what stops a later migration from widening that.
  const PUBLIC = ['offer_id', 'checked_at', 'result', 'note'];
  const PRIVATE = ['error', 'status_code', 'final_url', 'ok', 'id'];
  const grants = [...sql.matchAll(/grant select\s*\(([^)]*)\)\s*on public\.link_checks\s*to ([^;]+);/gi)]
    .map((m) => ({ columns: m[1].split(',').map((c) => c.trim()), to: m[2].trim() }));

  it('grants the reader four columns and no more', () => {
    expect(grants.length, 'a column-scoped grant must exist').toBeGreaterThan(0);
    for (const g of grants) {
      expect(g.columns.sort()).toEqual([...PUBLIC].sort());
      for (const secret of PRIVATE) expect(g.columns, `${secret} must stay private`).not.toContain(secret);
    }
  });

  it('never grants the whole table to a public role', () => {
    expect(sql).not.toMatch(/grant select on public\.link_checks/i);
    expect(sql).not.toMatch(/grant (all|select)[^;(]*on (public\.)?link_checks to (anon|authenticated|public)\s*;/i);
  });

  // A column grant only bites once the blanket one is gone: Postgres takes the
  // union of table- and column-level privileges, and this database was created
  // with table-wide grants to anon and authenticated. Without the revoke, the
  // read policy below would publish the diagnostics too.
  it('takes the blanket table privileges away first', () => {
    const revoke = sql.match(/revoke[^;]*on public\.link_checks[^;]*from[^;]*;/gi) ?? [];
    expect(revoke.length, 'the blanket grant must be revoked').toBeGreaterThan(0);
    const all = revoke.join('\n').toLowerCase();
    for (const role of ['anon', 'authenticated']) expect(all, role).toContain(role);
    // and the write privileges go with it — nothing public writes a check
    for (const write of ['insert', 'update', 'delete']) expect(all, write).toMatch(new RegExp(`${write}|all`));
  });

  it('lets that read reach published offers only', () => {
    const at = sql.lastIndexOf('create policy checks_read_published');
    expect(at, 'the read policy must exist').toBeGreaterThan(-1);
    const policy = sql.slice(at, sql.indexOf(';', at));
    expect(policy).toMatch(/for select/i);
    expect(policy).toMatch(/visibility = 'published'/);
  });
});

describe('the projection only ever moves forward', () => {
  it('leaves a stale batch out of offers while still recording it in history', () => {
    // the history insert is unconditional; the projection update is not
    expect(rpc).toMatch(/insert into public\.link_checks/);
    const update = rpc.slice(rpc.indexOf('update public.offers'));
    expect(update).toMatch(/where id = target_id[\s\S]{0,300}?last_checked/);
    expect(update).toMatch(/item_checked >=/);
  });
});
