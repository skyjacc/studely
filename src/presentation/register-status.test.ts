import { describe, it, expect } from 'vitest';
import { registerStatus } from './register-status';
import type { OfferView } from '@domain/offers/offer-mapping';

// The line under both headings. It counts what the register holds and says when
// the checker last ran — and it cannot say "verified" until a verifications row
// exists, which is the whole point of writing it from the data.

const o = (over: Partial<OfferView['data']> = {}, verification: OfferView['verification'] = { verified: false, at: null }): OfferView => ({
  id: 'x', slug: 'x', body: '', attributes: [], verification,
  data: {
    title: 'T', provider: 'P', category: 'design', summary: '', value: 'v', offerType: 'free',
    score: 8, url: 'https://x', affiliate: false, sponsored: false, featured: false,
    proofMethod: 'p', eligibility: 'e', expires: 'ongoing',
    lastChecked: new Date('2026-09-21T00:00:00Z'), lastCheckResult: 'pass', lastCheckNote: null,
    status: 'active', tags: [], ...over,
  },
});

describe('registerStatus', () => {
  it('counts the register and dates the newest check', () => {
    const s = registerStatus([o(), o({ lastChecked: new Date('2026-09-18T00:00:00Z') })]);
    expect(s.text).toBe('2 offers · links checked Sep 21, 2026');
    expect(s.offers).toBe(2);
    expect(s.lastChecked).toEqual(new Date('2026-09-21T00:00:00Z'));
  });

  it('says nothing about verification while nothing is verified', () => {
    const s = registerStatus([o(), o()]);
    expect(s.verified).toBe(0);
    expect(s.text).not.toMatch(/verified/i);
  });

  it('adds the count as soon as a human verification exists', () => {
    const s = registerStatus([o({}, { verified: true, at: '2026-09-18T00:00:00Z' }), o()]);
    expect(s.verified).toBe(1);
    expect(s.text).toBe('2 offers · links checked Sep 21, 2026 · 1 verified');
  });

  it('writes one offer as one offer', () => {
    expect(registerStatus([o()]).text).toMatch(/^1 offer · /);
  });

  it('drops the date rather than inventing one when no check has a usable date', () => {
    const s = registerStatus([o({ lastChecked: new Date(Number.NaN) })]);
    expect(s.lastChecked).toBeNull();
    expect(s.text).toBe('1 offer');
  });
});
