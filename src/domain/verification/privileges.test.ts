import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// RLS is not a privilege boundary. It filters SELECT, INSERT, UPDATE and
// DELETE — and nothing else. TRUNCATE is permitted by the grant alone, which is
// how `anon` (a key published in the site's own bundle) came to be one statement
// away from emptying the register. These read the migrations so a later one
// cannot quietly hand any of it back.
//
// The live proof runs against Postgres as each role inside a rolled-back
// transaction: docs/verification/0014-projection.md.

const DIR = join(process.cwd(), 'supabase/migrations');
const files = readdirSync(DIR).sort();
const raw = files.map((f) => readFileSync(join(DIR, f), 'utf8')).join('\n');
/** Comments talk about grants too; only the statements count. */
const sql = raw.replace(/--[^\n]*/g, '');
const PUBLIC_ROLES = ['anon', 'authenticated'];
/** Every `grant …` statement in the ledger, flattened for inspection. */
const grants = [...sql.matchAll(/grant\s+([\s\S]*?)\s+on\s+([^;]*?)\s+to\s+([^;]+);/gi)]
  .map((m) => ({ what: m[1].toLowerCase(), on: m[2].toLowerCase(), to: m[3].toLowerCase() }));

describe('the public roles hold no privilege RLS cannot police', () => {
  it.each(['truncate', 'trigger', 'references'])('takes %s away from anon and authenticated', (privilege) => {
    const revoked = sql.match(new RegExp(`revoke[^;]*${privilege}[^;]*from[^;]*;`, 'gi')) ?? [];
    const covered = revoked.filter((r) => PUBLIC_ROLES.every((role) => r.toLowerCase().includes(role)));
    expect(covered.length, `${privilege} must be revoked from both roles`).toBeGreaterThan(0);
  });

  it('never grants one of them back', () => {
    for (const g of grants) {
      if (!PUBLIC_ROLES.some((role) => g.to.includes(role))) continue;
      for (const privilege of ['truncate', 'trigger', 'references', 'all privileges']) {
        expect(g.what, `${g.what} on ${g.on} to ${g.to}`).not.toContain(privilege);
      }
    }
  });

  it('fixes the schema defaults, so the next table starts clean', () => {
    const defaults = sql.match(/alter default privileges[^;]*;/gi) ?? [];
    const revoke = defaults.filter((d) => /revoke/i.test(d));
    expect(revoke.length, 'default privileges must be narrowed too').toBeGreaterThan(0);
    const all = revoke.join('\n').toLowerCase();
    for (const privilege of ['truncate', 'trigger', 'references']) expect(all).toContain(privilege);
    for (const role of PUBLIC_ROLES) expect(all).toContain(role);
  });

  it('grants a public role nothing that implies ownership or DDL', () => {
    for (const g of grants) {
      if (!PUBLIC_ROLES.some((role) => g.to.includes(role))) continue;
      expect(g.what).toMatch(/^(select|insert|update|delete|execute|usage)\b/);
    }
  });
});
