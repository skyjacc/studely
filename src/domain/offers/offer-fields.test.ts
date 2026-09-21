import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { OFFER_FIELDS, EDITABLE_COLUMNS, FORM_LAYOUT, rowToForm } from './offer-fields';

const MIGRATIONS = join(process.cwd(), 'supabase', 'migrations');

/** Body of the newest migration that (re)defines the editor RPC. */
function latestRpcSql(): string {
  const files = readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort();
  for (const f of [...files].reverse()) {
    const sql = readFileSync(join(MIGRATIONS, f), 'utf8');
    if (/create or replace function public\.update_offer_with_attributes/.test(sql)) return sql;
  }
  throw new Error('no migration defines update_offer_with_attributes');
}

describe('offer field registry', () => {
  it('names each column once', () => {
    const names = OFFER_FIELDS.map((f) => f.name);
    expect(new Set(names).size).toBe(names.length);
    expect(EDITABLE_COLUMNS).toEqual(names);
  });

  it('never contains the columns only the database may write', () => {
    for (const forbidden of ['score', 'visibility', 'slug', 'id', 'created_by', 'created_at', 'updated_at']) {
      expect(EDITABLE_COLUMNS).not.toContain(forbidden);
    }
  });

  // The SQL keeps an explicit column list on purpose (no dynamic SQL). This is
  // the guard that makes the registry and the RPC one declaration in practice:
  // a column added here without a `col = ...` line in the newest RPC migration
  // is a red build, not a field that reaches the database and never the form.
  it('is fully written by the editor RPC in the latest migration', () => {
    const sql = latestRpcSql();
    for (const col of EDITABLE_COLUMNS) {
      // the first assignment sits on the `set` line: `set title = ...`
      expect(sql, `RPC does not assign ${col}`).toMatch(new RegExp(`^\\s+(?:set\\s+)?${col}\\s+=`, 'm'));
    }
  });

  it('is fully present in the form layout', () => {
    const laidOut = new Set(FORM_LAYOUT.flat());
    for (const col of EDITABLE_COLUMNS) expect(laidOut, `form layout misses ${col}`).toContain(col);
    for (const name of laidOut) expect(EDITABLE_COLUMNS, `layout names unknown field ${name}`).toContain(name);
  });

  it('carries affiliate_url and proof_method', () => {
    expect(EDITABLE_COLUMNS).toContain('affiliate_url');
    expect(EDITABLE_COLUMNS).toContain('proof_method');
    expect(EDITABLE_COLUMNS).not.toContain('verification');
  });
});

describe('rowToForm', () => {
  it('turns a row into form values: nulls to empty strings, tags joined, flags boolean', () => {
    const v = rowToForm({
      title: 'X', provider: 'P', category: 'design', summary: 's', value: 'v', body: '',
      offer_type: 'free', discount_percent: null, url: 'https://x', affiliate_url: null,
      proof_method: 'SheerID', eligibility: 'Students', status: 'active', expires_at: null,
      tags: ['a', 'b'], affiliate: false, sponsored: false, featured: true,
    });
    expect(v.discount_percent).toBe('');
    expect(v.affiliate_url).toBe('');
    expect(v.expires_at).toBe('');
    expect(v.tags).toBe('a, b');
    expect(v.featured).toBe(true);
    expect(v.proof_method).toBe('SheerID');
  });
});
