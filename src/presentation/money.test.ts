import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { moneyDisclosure } from './money';
import { adsRunning, moneyPosition, type AdsConfig } from '@domain/affiliate/position';
import { site } from '@core/config/site';

// What the site says it earns, in one place. Five surfaces state this — the
// footer, /about, /methodology, the disclosure policy and the register row —
// and before this they each stated it as a sentence somebody had typed. The
// first partner link would have made four of them false at once, silently.
//
// Every one of them is now a projection of moneyPosition.

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');
const walk = (dir: string, out: string[] = []): string[] => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p.replace(ROOT + '/', ''));
  }
  return out;
};
const PUBLIC = walk(join(ROOT, 'src')).filter(
  (f) => /\.(astro|ts|md)$/.test(f) && !f.endsWith('.test.ts') &&
    !f.startsWith('src/pages/admin/') && !f.startsWith('src/presentation/components/admin/'),
);

const ads = (over: Partial<AdsConfig> = {}): AdsConfig =>
  ({ enabled: true, client: 'ca-pub-1', slots: { inFeed: '', inArticle: '', leaderboard: '' }, ...over });
const adsLive = ads({ slots: { inFeed: '9', inArticle: '', leaderboard: '' } });
const offer = (over: { affiliate?: boolean; sponsored?: boolean } = {}) =>
  ({ affiliate: false, sponsored: false, ...over });

/** The five states the contract has to cover. */
const FIXTURES = {
  none: moneyPosition([offer(), offer()], ads()),
  oneAffiliate: moneyPosition([offer({ affiliate: true }), offer()], ads()),
  affiliateAndSponsored: moneyPosition([offer({ affiliate: true }), offer({ affiliate: true }), offer({ sponsored: true })], ads()),
  adsOnly: moneyPosition([offer()], adsLive),
  affiliateAndAds: moneyPosition([offer({ affiliate: true })], adsLive),
};

describe('the sentence follows the facts', () => {
  it('says the site earns nothing only while it earns nothing', () => {
    expect(moneyDisclosure(FIXTURES.none).text).toMatch(/earns nothing/i);
    for (const [name, facts] of Object.entries(FIXTURES)) {
      if (name === 'none') continue;
      expect(moneyDisclosure(facts).text, name).not.toMatch(/earns nothing/i);
    }
  });

  // The empty state must be free to SAY "no offer here is a partner link" —
  // that sentence is the disclosure. What it may not do is claim the income.
  it('claims income from partner links only when there are some', () => {
    expect(moneyDisclosure(FIXTURES.none).text).not.toMatch(/earns from partner/i);
    expect(moneyDisclosure(FIXTURES.oneAffiliate).text).toMatch(/earns from partner links/i);
    expect(moneyDisclosure(FIXTURES.oneAffiliate).text).toMatch(/one offer here is a partner link/i);
  });

  it('claims income from advertising only while ads are served', () => {
    expect(moneyDisclosure(FIXTURES.none).text).not.toMatch(/earns from advertising|ads are served/i);
    expect(moneyDisclosure(FIXTURES.none).text).toMatch(/no advertising is running/i);
    expect(moneyDisclosure(FIXTURES.adsOnly).text).toMatch(/earns from advertising/i);
    expect(moneyDisclosure(FIXTURES.affiliateAndAds).text).toMatch(/ads are served/i);
  });

  it('keeps the promise that does not depend on the state', () => {
    // the one claim that is true in every state, and the reason the page exists
    for (const facts of Object.values(FIXTURES)) {
      expect(moneyDisclosure(facts).text).toMatch(/never|not change/i);
    }
  });

  it('names the state it is in, so a consumer can branch without re-reading the words', () => {
    expect(moneyDisclosure(FIXTURES.none).state).toBe('nothing');
    expect(moneyDisclosure(FIXTURES.oneAffiliate).state).toBe('affiliate');
    expect(moneyDisclosure(FIXTURES.adsOnly).state).toBe('ads');
    expect(moneyDisclosure(FIXTURES.affiliateAndAds).state).toBe('both');
  });

  it('counts sponsored placements as their own fact, not as partner links', () => {
    const sponsoredOnly = moneyPosition([offer({ sponsored: true })], ads());
    expect(moneyDisclosure(sponsoredOnly).state).toBe('nothing');
    expect(moneyDisclosure(sponsoredOnly).text).toMatch(/sponsored/i);
  });
});

// Advertising is the other half, and it behaves differently: its state lives in
// this repository (site.adsense), so the cookie and privacy pages are allowed to
// describe it in prose — a cookie notice has to explain why a cookie may be set
// while no ad is shown. What they may not do is fall behind. This ties the
// sentences to the configuration: switch a slot on, and CI fails until they are
// rewritten.
describe('the advertising prose cannot outlive the configuration', () => {
  const ADS_ARE_OFF = [/no ad unit is configured/i, /no (advertisement|ad) is served/i, /no advertising is (running|being served)/i];

  it('says ads are not running only while they are not', () => {
    const running = adsRunning(site.adsense);
    const pages = PUBLIC.filter((f) => f.endsWith('.md') || f.startsWith('src/pages/'));
    const saysOff = pages.filter((f) => ADS_ARE_OFF.some((c) => c.test(read(f))));
    if (running) {
      expect(saysOff, 'ads are live — these pages still say they are not').toEqual([]);
    } else {
      // today: the claim is true, and at least one policy makes it
      expect(saysOff.length).toBeGreaterThan(0);
    }
  });
});

describe('no surface keeps its own copy of the claim', () => {
  it('states the position nowhere but the presenter', () => {
    // the claims that were hand-typed on four surfaces; the presenter is the
    // one place allowed to make them, and it makes them conditionally
    // Claims about PARTNER LINKS cannot be checked from the repository — the
    // count lives in the database — so prose may not make them at all. The
    // presenter says it once, from the data.
    const CLAIMS = [
      /earns? (nothing|no commission)/i,
      /\b(no|none|neither)\b[^.]{0,60}\b(affiliate|partner) link\b/i,
      /no sponsored placements/i,
    ];
    const offenders: string[] = [];
    for (const f of PUBLIC) {
      // The two places allowed to state it, because both state it FROM data:
      // the presenter (the site's position) and the record's per-offer line.
      if (f === 'src/presentation/money.ts' || f === 'src/presentation/record.ts') continue;
      // a policy page is prose from top to bottom; a component's comments
      // explain the code and are not a claim to a reader
      const body = f.endsWith('.md')
        ? read(f)
        : read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/<!--[\s\S]*?-->/g, '');
      if (CLAIMS.some((c) => c.test(body))) offenders.push(f);
    }
    expect(offenders).toEqual([]);
  });

  it('has no site-wide disclosure constant left to go stale', () => {
    expect(read('src/core/config/site.ts')).not.toMatch(/affiliateDisclosure/);
  });

  it('renders it in each of the four site-wide surfaces from the presenter', () => {
    for (const f of [
      'src/presentation/components/Footer.astro',
      'src/pages/about.astro',
      'src/pages/methodology.astro',
      'src/presentation/layouts/LegalLayout.astro',
    ]) {
      expect(read(f), f).toMatch(/moneyDisclosure|MoneyNote/);
    }
  });
});
