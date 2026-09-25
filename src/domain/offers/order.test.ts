import { describe, it, expect } from 'vitest';
import { defaultRegisterOrder } from './order';
import type { OfferView } from './offer-mapping';

// The register has one default order, and both pages that show entries read it
// from here. A second ranking on the home page would mean "the top of the
// register" was not the top of the register.

const o = (over: Partial<OfferView['data']> & { slug?: string }): OfferView => ({
  id: over.slug ?? 'x', slug: over.slug ?? 'x', body: '', attributes: [],
  verification: { verified: false, at: null },
  data: {
    title: 'T', provider: 'P', category: 'design', summary: '', value: 'v', offerType: 'free',
    score: 5, url: 'https://x', affiliate: false, sponsored: false, featured: false,
    proofMethod: 'p', eligibility: 'e', expires: 'ongoing',
    lastChecked: new Date('2026-09-21T00:00:00Z'), lastCheckResult: 'pass', lastCheckNote: null,
    status: 'active', tags: [], ...over,
  },
});

describe('defaultRegisterOrder', () => {
  it('ranks by score, high to low', () => {
    const list = [o({ slug: 'a', score: 8 }), o({ slug: 'b', score: 10 })].sort(defaultRegisterOrder);
    expect(list.map((x) => x.slug)).toEqual(['b', 'a']);
  });

  it('breaks a tie with the most recent check', () => {
    const list = [
      o({ slug: 'older', score: 9, lastChecked: new Date('2026-09-01T00:00:00Z') }),
      o({ slug: 'newer', score: 9, lastChecked: new Date('2026-09-21T00:00:00Z') }),
    ].sort(defaultRegisterOrder);
    expect(list.map((x) => x.slug)).toEqual(['newer', 'older']);
  });

  it('gives featured and sponsored no rank at all', () => {
    const list = [
      o({ slug: 'plain', score: 9 }),
      o({ slug: 'flagged', score: 7, featured: true, sponsored: true }),
    ].sort(defaultRegisterOrder);
    expect(list.map((x) => x.slug)).toEqual(['plain', 'flagged']);
  });
});
