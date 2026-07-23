import { describe, it, expect } from 'vitest';
import { mapOfferRow, type OfferRow, type OfferAttr } from './offer-mapping';

const baseRow: OfferRow = {
  id: '11111111-1111-1111-1111-111111111111',
  slug: 'github-student-pack',
  title: 'GitHub Student Developer Pack',
  provider: 'GitHub',
  category: 'developer',
  summary: 'Free developer tools for students.',
  value: '$200k+ in tools',
  body: '## What you get\n\n- Stuff',
  offer_type: 'free',
  discount_percent: null,
  url: 'https://education.github.com/pack',
  affiliate: false,
  sponsored: false,
  featured: true,
  verification: 'GitHub education',
  eligibility: 'Verified students worldwide',
  tags: ['dev', 'tools'],
  score: 9,
  status: 'active',
  expires_at: null,
  last_checked: '2026-07-20T10:00:00+00:00',
};

describe('mapOfferRow', () => {
  it('maps snake_case columns to the collection-entry shape', () => {
    const v = mapOfferRow(baseRow);
    expect(v.id).toBe('github-student-pack');
    expect(v.slug).toBe('github-student-pack');
    expect(v.data.offerType).toBe('free');
    expect(v.data.title).toBe('GitHub Student Developer Pack');
    expect(v.data.score).toBe(9);
    expect(v.body).toBe('## What you get\n\n- Stuff');
  });

  it('turns a null expires_at into the literal "ongoing"', () => {
    expect(mapOfferRow(baseRow).data.expires).toBe('ongoing');
  });

  it('passes a real expires_at through as a string', () => {
    expect(mapOfferRow({ ...baseRow, expires_at: '2026-12-31' }).data.expires).toBe('2026-12-31');
  });

  it('coerces last_checked into a Date', () => {
    const d = mapOfferRow(baseRow).data.lastChecked;
    expect(d).toBeInstanceOf(Date);
    expect(d.getTime()).toBe(Date.parse('2026-07-20T10:00:00+00:00'));
  });

  it('omits discountPercent when the column is null', () => {
    expect('discountPercent' in mapOfferRow(baseRow).data).toBe(false);
  });

  it('includes discountPercent when the column is set', () => {
    expect(mapOfferRow({ ...baseRow, discount_percent: 50 }).data.discountPercent).toBe(50);
  });

  it('defaults null tags to an empty array', () => {
    expect(mapOfferRow({ ...baseRow, tags: null }).data.tags).toEqual([]);
  });

  it('attaches the attributes passed to it', () => {
    const attrs: OfferAttr[] = [{ key: 'card_required', label: 'Card required', points: -2 }];
    expect(mapOfferRow(baseRow, attrs).attributes).toEqual(attrs);
  });

  it('defaults verification to unverified — never guesses from status', () => {
    expect(mapOfferRow(baseRow).verification).toEqual({ verified: false, at: null });
  });

  it('carries a real passing verification when given', () => {
    const v = { verified: true, at: '2026-07-20T00:00:00Z' };
    expect(mapOfferRow(baseRow, [], v).verification).toEqual(v);
  });
});
