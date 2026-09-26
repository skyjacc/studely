import { describe, it, expect } from 'vitest';
import { adsRunning, moneyPosition, type AdsConfig } from './position';

// What the site earns, as a count of records. Facts only: this module answers
// "how many partner links, how many sponsored placements, is advertising
// running" and nothing else. No URL resolution, no CTA semantics, no wording —
// those belong to /go, to cta.ts and to the presenter respectively.

const ads = (over: Partial<AdsConfig> = {}): AdsConfig =>
  ({ enabled: true, client: 'ca-pub-1', slots: { inFeed: '', inArticle: '', leaderboard: '' }, ...over });
const offer = (over: { affiliate?: boolean; sponsored?: boolean } = {}) =>
  ({ affiliate: false, sponsored: false, ...over });

describe('adsRunning — one predicate, not a judgement per consumer', () => {
  it('is false while no slot id exists, however enabled the account is', () => {
    expect(adsRunning(ads())).toBe(false);
  });

  it('is true once a slot can actually serve', () => {
    expect(adsRunning(ads({ slots: { inFeed: '123', inArticle: '', leaderboard: '' } }))).toBe(true);
  });

  it('is false when the integration is switched off, or has no account', () => {
    expect(adsRunning(ads({ enabled: false, slots: { inFeed: '123', inArticle: '', leaderboard: '' } }))).toBe(false);
    expect(adsRunning(ads({ client: '', slots: { inFeed: '123', inArticle: '', leaderboard: '' } }))).toBe(false);
  });
});

describe('moneyPosition', () => {
  it('counts partner links and sponsored placements separately', () => {
    const p = moneyPosition([
      offer({ affiliate: true }),
      offer({ affiliate: true, sponsored: true }),
      offer({ sponsored: true }),
      offer(),
    ], ads());
    expect(p).toEqual({ affiliateLinks: 2, sponsoredOffers: 2, adsRunning: false });
  });

  it('reports the empty position as zeroes, not as nothing', () => {
    expect(moneyPosition([offer(), offer()], ads())).toEqual({ affiliateLinks: 0, sponsoredOffers: 0, adsRunning: false });
  });

  it('takes advertising from the one predicate', () => {
    const live = ads({ slots: { inFeed: '9', inArticle: '', leaderboard: '' } });
    expect(moneyPosition([offer()], live).adsRunning).toBe(true);
  });

  it('knows nothing about URLs, redirects or rel attributes', async () => {
    // comments may name what lives elsewhere; code may not reach for it
    const file = await import('node:fs').then((fs) => fs.readFileSync('src/domain/affiliate/position.ts', 'utf8'));
    const source = file.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    for (const foreign of ['affiliate_url', 'resolveTarget', 'rel=', '/go/', 'sponsored nofollow']) {
      expect(source, foreign).not.toContain(foreign);
    }
  });
});
