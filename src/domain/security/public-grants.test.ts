import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// A closed allow-list for what the public roles may write. Asserting the
// revokes alone would pass a migration that took everything away and then
// granted half the schema back, so this states the end state: exactly these
// table/verb pairs, and nothing else.
//
// The live proof — that each grant is present, each absent one really is
// absent, and the one anonymous write path still works — runs against Postgres
// in a rolled-back transaction: docs/verification/public-grants.md.

const DIR = join(process.cwd(), 'supabase/migrations');
const raw = readdirSync(DIR).sort().map((f) => readFileSync(join(DIR, f), 'utf8')).join('\n');
/** Comments in this ledger discuss grants at length; only statements count. */
const sql = raw.replace(/--[^\n]*/g, '');

const ALLOWED: Record<string, Record<string, string[]>> = {
  anon: { offer_clicks: ['insert'] },
  authenticated: {
    offers: ['insert', 'update', 'delete'],
    offer_attributes: ['insert', 'delete'],
    offer_clicks: ['insert'],
  },
};
const WRITE = ['insert', 'update', 'delete'];
const AUDITED = [
  'categories', 'comments', 'offer_attributes', 'offer_clicks', 'offer_ratings',
  'offers', 'profiles', 'submissions', 'verifications',
];

/** Every `grant <verbs> on <tables> to <roles>` in the ledger, flattened. */
const granted = (() => {
  const out: { role: string; table: string; verb: string }[] = [];
  for (const m of sql.matchAll(/grant\s+([a-z, ]+?)\s+on\s+([^;]*?)\s+to\s+([^;]+);/gi)) {
    const verbs = m[1].toLowerCase().split(',').map((v) => v.trim());
    const tables = m[2].toLowerCase().split(',').map((t) => t.trim().replace(/^public\./, ''));
    const roles = m[3].toLowerCase().split(',').map((r) => r.trim());
    for (const role of roles) for (const table of tables) for (const verb of verbs) out.push({ role, table, verb });
  }
  return out;
})();

describe('what the public roles may write', () => {
  it('takes the inherited write privileges away from every audited table', () => {
    const revokes = sql.match(/revoke[^;]*;/gi) ?? [];
    const relevant = revokes.filter((r) => WRITE.every((v) => r.toLowerCase().includes(v)));
    expect(relevant.length, 'a revoke of insert/update/delete must exist').toBeGreaterThan(0);
    const text = relevant.join('\n').toLowerCase();
    for (const table of AUDITED) expect(text, table).toContain(table);
    for (const role of ['anon', 'authenticated']) expect(text, role).toContain(role);
  });

  it('grants back the allow-list and nothing else', () => {
    for (const { role, table, verb } of granted) {
      if (!WRITE.includes(verb)) continue; // select/execute/usage are not this audit
      const allowed = ALLOWED[role]?.[table] ?? [];
      expect(allowed, `${role} may not ${verb} ${table}`).toContain(verb);
    }
  });

  it('leaves no allow-list entry ungranted', () => {
    for (const [role, tables] of Object.entries(ALLOWED)) {
      for (const [table, verbs] of Object.entries(tables)) {
        for (const verb of verbs) {
          const found = granted.some((g) => g.role === role && g.table === table && g.verb === verb);
          expect(found, `${role} needs ${verb} on ${table}`).toBe(true);
        }
      }
    }
  });

  it('never gives a public role a write on the checker or the profiles', () => {
    for (const { role, table, verb } of granted) {
      if (!['anon', 'authenticated'].includes(role) || !WRITE.includes(verb)) continue;
      expect(['link_checks', 'profiles'], `${role} ${verb} ${table}`).not.toContain(table);
    }
  });

  it('changes no policy — this audit is about grants', () => {
    const own = readFileSync(join(DIR, '0019_narrow_public_write_privileges.sql'), 'utf8').replace(/--[^\n]*/g, '');
    expect(own).not.toMatch(/create policy|drop policy|alter policy|enable row level security/i);
  });
});
