import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// The register as a contract (Visual Direction v3 §1, §3, §9, §11). These read
// the source, so they hold on every build: the row is the only offer
// representation, one derivation feeds every view of it, the ad is never an
// entry, and the mobile row is one real link rather than a div with a handler.

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');
const page = read('src/pages/offers/index.astro');
const row = read('src/presentation/components/EntryRow.astro');
const styleOf = (src: string) => [...src.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');
/** The body of every `@media (max-width: <=900px)` block in a stylesheet. */
const narrow = (css: string) => {
  const out: string[] = [];
  for (const m of css.matchAll(/@media\s*\(max-width:\s*(\d+)px\)\s*\{/g)) {
    if (Number(m[1]) > 900) continue;
    let depth = 1, i = m.index! + m[0].length;
    const start = i;
    while (i < css.length && depth > 0) { if (css[i] === '{') depth++; else if (css[i] === '}') depth--; i++; }
    out.push(css.slice(start, i - 1));
  }
  return out.join('\n');
};

describe('one derivation', () => {
  it('builds every view from the entry-row model', () => {
    expect(page).toMatch(/entryRowModel/);
    expect(row).toMatch(/EntryRowModel/);
  });

  it('never recomputes score or trust in the page or the row', () => {
    for (const [name, src] of [['page', page], ['row', row]] as const) {
      expect(src, name).not.toMatch(/deriveTrust|scoreWord|scoreTier|formatScore|describeScore|formatTrustDate/);
    }
  });

  it('keeps the register on the domain contracts it must not bypass', () => {
    expect(page).toMatch(/from '@domain\/offers\/directory-state'/);
    expect(page).toMatch(/adAfterIndexes/);
    expect(page).not.toMatch(/href=\{?["'`]?\/go\//); // the outbound link comes from cta.ts, via the model
  });
});

describe('the row is not a card', () => {
  it('shows no category, no summary and no logo', () => {
    expect(row).not.toMatch(/summary|Logo|logo-tile|getCategory/);
    expect(page).not.toMatch(/OfferPreview|components\/Logo\.astro/);
  });

  it('draws rules, not a card surface', () => {
    const css = styleOf(row);
    expect(css).not.toMatch(/border-radius|box-shadow/);
    expect(css).toMatch(/border-top:\s*1px solid/);
  });

  it('keeps the score secondary: never larger than the title', () => {
    const css = styleOf(row);
    const size = (sel: string) => css.match(new RegExp(`\\.${sel}[^{]*\\{[^}]*font-size:\\s*var\\((--step-[-0-9a-z]+)\\)`))?.[1];
    const STEPS = ['--step--2', '--step--1', '--step-0', '--step-1', '--step-2', '--step-3', '--step-4'];
    expect(STEPS.indexOf(size('num')!)).toBeLessThanOrEqual(STEPS.indexOf(size('title')!));
  });

  it('carries no scroll reveal — rows are content, not a story', () => {
    expect(row).not.toMatch(/data-reveal|data-split|data-enter/);
    expect(page).not.toMatch(/data-reveal|data-split/);
  });
});

describe('one trust vocabulary', () => {
  const badge = read('src/presentation/components/StateBadge.astro');
  it('gives the problem states a single source of words, shared with the row', () => {
    expect(badge).toMatch(/from '@ui\/entry-row'|from '\.\.\/entry-row'/);
    // the words themselves live in entry-row.ts, so the record and the register
    // cannot describe the same checker state differently
    expect(badge).not.toMatch(/Provider blocks|Could not reach|Not checked since|Link failed/);
  });
});

describe('the ad is an interruption, not an entry', () => {
  it('renders a labelled full-width zone with no entry slots', () => {
    const ad = page.match(/<div class="interruption"[\s\S]*?<\/div>/);
    expect(ad, 'the interruption markup').not.toBeNull();
    expect(ad![0]).toMatch(/ADVERTISEMENT/);
    expect(ad![0]).not.toMatch(/class="(n|provider|score)"/);
    expect(ad![0]).not.toMatch(/entry/);
  });

  it('appears only in the pristine default sort, and only with a slot id', () => {
    expect(page).toMatch(/isPristine/);
    expect(page).toMatch(/site\.adsense\.slots\.inFeed \? adAfterIndexes/);
  });
});

describe('mobile: one target per row', () => {
  it('makes the whole row a real link, not a div with a handler', () => {
    const css = narrow(styleOf(row));
    expect(css).toMatch(/\.title a::after[\s\S]*?position:\s*absolute/); // the record link covers the row
    expect(css).toMatch(/\.action\s*\{[^}]*display:\s*none/);            // no second target beside it
    expect(row).not.toMatch(/onclick|addEventListener/);
  });

  it('drops the table below 900px rather than scrolling it sideways', () => {
    expect(narrow(styleOf(page))).toMatch(/\.tablewrap\s*\{[^}]*display:\s*none/);
  });
});
