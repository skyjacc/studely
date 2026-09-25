import { describe, it, expect } from 'vitest';
import { getOfferHistory } from '@domain/offers/offers-source';
import { recordHistory } from './history';

// One test that actually talks to the database the build reads. The build reads
// as `anon` (ADR-0030: no service-role key outside the checker's workflow), so
// this is the thing that proves the privilege boundary set in 0015/0016 leaves
// the record's history reachable — a mistake there is invisible until a page
// renders empty. Skipped without credentials; CI runs the rest.
const live = Boolean(process.env.PUBLIC_SUPABASE_URL && process.env.PUBLIC_SUPABASE_ANON_KEY);

describe.runIf(live)('the history the build actually reads', () => {
  it('returns real check rows for a published offer, newest first', async () => {
    const events = recordHistory(await getOfferHistory('github-student-pack'));
    expect(events.length).toBeGreaterThan(0);
    const checks = events.filter((e) => e.kind === 'check');
    expect(checks.length, 'link_checks must be readable').toBeGreaterThan(0);
    const dates = events.map((e) => e.at.getTime());
    expect([...dates].sort((a, b) => b - a)).toEqual(dates);
  });
}, 20_000);
