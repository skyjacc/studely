import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { entryRowModel } from './entry-row';
import { moneyPosition, type AdsConfig } from '@domain/affiliate/position';
import type { OfferView } from '@domain/offers/offer-mapping';

// A reader can leave the register straight from a row, so the disclosure has to
// travel with the link rather than waiting on the record. Two different facts,
// two labels: a partner link is money, a sponsored placement is a paid position.
// Neither stands in for the other and both can be true at once.

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');
const NOW = new Date('2026-09-26T12:00:00Z');

function offer(over: Partial<OfferView['data']> = {}): OfferView {
  return {
    id: 'x', slug: 'x', body: '', attributes: [], verification: { verified: false, at: null },
    data: {
      title: 'An offer', provider: 'Provider', category: 'design', summary: '', value: 'v', offerType: 'free',
      score: 8, url: 'https://x.example', affiliate: false, sponsored: false, featured: false,
      proofMethod: 'p', eligibility: 'e', expires: 'ongoing',
      lastChecked: new Date('2026-09-25T00:00:00Z'), lastCheckResult: 'pass', lastCheckNote: null,
      status: 'active', tags: [], updatedAt: null, ...over,
    },
  };
}

describe('the row carries its own disclosure', () => {
  it('reports a partner link as a fact of the row', () => {
    expect(entryRowModel(offer({ affiliate: true }), 0, NOW).affiliate).toBe(true);
    expect(entryRowModel(offer(), 0, NOW).affiliate).toBe(false);
  });

  it('keeps sponsorship and partnership apart', () => {
    const both = entryRowModel(offer({ affiliate: true, sponsored: true }), 0, NOW);
    expect(both).toMatchObject({ affiliate: true, sponsored: true });
    const paidOnly = entryRowModel(offer({ sponsored: true }), 0, NOW);
    expect(paidOnly).toMatchObject({ affiliate: false, sponsored: true });
  });

  it('labels each one in the row, and neither instead of the other', () => {
    const row = read('src/presentation/components/EntryRow.astro');
    expect(row).toMatch(/e\.affiliate &&/);
    expect(row).toMatch(/e\.sponsored &&/);
    expect(row).toMatch(/Partner link/);
    expect(row).toMatch(/Sponsored/);
    // no conflation
    expect(row).not.toMatch(/affiliate \|\| sponsored|sponsored \|\| affiliate/);
  });
});

describe('the row and the site-wide sentence come from one position', () => {
  const ads: AdsConfig = { enabled: true, client: 'ca-pub-1', slots: { inFeed: '', inArticle: '', leaderboard: '' } };

  it('agrees on how many partner links there are', () => {
    const offers = [offer({ affiliate: true }), offer({ affiliate: true }), offer({ sponsored: true }), offer()];
    const position = moneyPosition(offers.map((o) => o.data), ads);
    const rowsDisclosing = offers.map((o, i) => entryRowModel(o, i, NOW)).filter((r) => r.affiliate).length;
    expect(rowsDisclosing).toBe(position.affiliateLinks);
    const rowsSponsored = offers.map((o, i) => entryRowModel(o, i, NOW)).filter((r) => r.sponsored).length;
    expect(rowsSponsored).toBe(position.sponsoredOffers);
  });
});
