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

describe('the projection only ever moves forward', () => {
  it('leaves a stale batch out of offers while still recording it in history', () => {
    // the history insert is unconditional; the projection update is not
    expect(rpc).toMatch(/insert into public\.link_checks/);
    const update = rpc.slice(rpc.indexOf('update public.offers'));
    expect(update).toMatch(/where id = target_id[\s\S]{0,300}?last_checked/);
    expect(update).toMatch(/item_checked >=/);
  });
});
