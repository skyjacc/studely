import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Package 5 is a cleanup, which means two obligations of equal weight: what the
// register no longer needs is gone, and what it still uses is untouched. A test
// that only checked the first would pass a commit that deleted the site.

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
const SRC = walk(join(ROOT, 'src'));
const sources = SRC.filter((f) => /\.(astro|ts)$/.test(f) && !f.endsWith('.test.ts'));
const PUBLIC = sources.filter(
  (f) => !f.startsWith('src/pages/admin/') && !f.startsWith('src/presentation/components/admin/') && f !== 'src/presentation/layouts/AdminLayout.astro',
);

describe('the card model is gone', () => {
  const RETIRED = [
    'src/presentation/components/OfferPreview.astro',
    'src/presentation/components/OfferCTA.astro',
    'src/presentation/components/Score.astro',
    'src/presentation/components/TrustRow.astro',
    'src/presentation/components/StateBadge.astro',
    'src/presentation/components/Logo.astro',
    'src/presentation/components/Badge.astro',
  ];

  it.each(RETIRED)('%s is deleted', (path) => {
    expect(existsSync(join(ROOT, path))).toBe(false);
  });

  it('nothing imports a retired component', () => {
    const names = RETIRED.map((p) => p.split('/').pop()!.replace('.astro', ''));
    for (const f of sources) {
      for (const name of names) {
        expect(read(f), `${f} imports ${name}`).not.toMatch(new RegExp(`import ${name} from|components/${name}\\.astro`));
      }
    }
  });

  it('drops the card rules from the public stylesheet', () => {
    const css = read('src/styles/paper.css');
    for (const rule of ['.card', '.badge', '.score-high', '.score-mid', '.score-low', '.logo-tile', '.grid-offers', '.grid-cats', '.mark']) {
      expect(css, rule).not.toContain(rule);
    }
  });

  it('keeps the rules the rest of the site is built from', () => {
    const css = read('src/styles/paper.css');
    // contact, methodology, about, the legal pages and the record still use these
    for (const rule of ['.btn', '.prose', '.lead', '.eyebrow', '.muted', '.sr-only']) {
      expect(css + read('src/styles/base.css'), rule).toContain(rule);
    }
  });
});

describe('one token vocabulary on the public surface', () => {
  it('leaves no alias of a canonical token in paper.css', () => {
    const root = read('src/styles/paper.css');
    for (const alias of ['--border-soft', '--border-strong', '--border-control', '--surface:']) {
      expect(root, alias).not.toContain(alias);
    }
    expect(root).toMatch(/--rule-soft|--rule-strong/); // the canonical names stay
  });

  it('has every public file speak the canonical names', () => {
    const offenders = PUBLIC.filter((f) => /var\(--border[a-z-]*\)|var\(--surface\)/.test(read(f)));
    expect(offenders).toEqual([]);
  });

  it('leaves the admin surface its own vocabulary', () => {
    // admin.css declares --border* for itself; this migration is public-only
    expect(read('src/styles/admin.css')).toMatch(/--border(-[a-z]+)?:/);
  });
});

describe('the contracts drop what no longer exists', () => {
  it('knows only the placements the site has', () => {
    const cta = read('src/domain/affiliate/cta.ts');
    expect(cta).toMatch(/'row' \| 'detail'/);
    expect(cta).not.toMatch(/'card'/);
  });

  it('names the register view after what it is', () => {
    const state = read('src/domain/offers/directory-state.ts');
    expect(state).toMatch(/ViewKey = 'index' \| 'table'/);
    expect(state).not.toMatch(/'cards'/);
  });

  it('exports no helper the site stopped calling', () => {
    const offers = read('src/domain/offers/offers.ts');
    for (const dead of ['sortOffers', 'isExpiringSoon', 'scoreTier']) {
      expect(offers, dead).not.toMatch(new RegExp(`export (function|const) ${dead}\\b`));
    }
  });

  it('still keeps one source for the words a state is given', () => {
    // StateBadge is gone, so the vocabulary has one consumer rather than two —
    // it must still live in exactly one place. Comments may quote the wording
    // (they explain it); only code counts.
    const code = (f: string) => read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    const definitions = PUBLIC.filter((f) => /PROBLEM_COPY|'Provider blocks automated checks/.test(code(f)));
    expect(definitions).toEqual(['src/presentation/entry-row.ts']);
  });
});

describe('a scrim is made of paper', () => {
  // The 404 lifted its text off the backdrop with a scrim written as
  // rgba(var(--ink-rgb), 0.9). While the theme was dark that token WAS the
  // light beige, so the rule read "page colour over the field". Paper flipped
  // it to near-black and the same line painted a cloud over the text — invisible
  // to every gate we had, because they measured the DOM and not the pixels.
  it('gives the 404 a paper scrim, and paper a channel to write one with', () => {
    const nf = read('src/pages/404.astro');
    expect(read('src/styles/paper.css')).toMatch(/--bg-rgb:/);
    // the scrim under the 404's own text, specifically
    const scrim = (nf.replace(/\/\*[\s\S]*?\*\//g, '').match(/\.nf::after \{[\s\S]*?\}/)?.[0]) ?? '';
    expect(scrim).toMatch(/rgba\(var\(--bg-rgb\)/);
    expect(scrim).not.toMatch(/--ink-rgb/);
  });

  // A generic "no heavy ink background" rule would flag HeroField's 0.55 dots,
  // which are a 1px halftone and not a wash at all. Source cannot tell area
  // from alpha, so the rest of this belongs to the rendered check: the browser
  // gate measures contrast on 404 against the paper behind it.
});

describe('the category index is retired, not merely deleted', () => {
  it('leaves no page behind', () => {
    expect(existsSync(join(ROOT, 'src/pages/categories.astro'))).toBe(false);
    expect(existsSync(join(ROOT, 'src/presentation/components/CategoryCard.astro'))).toBe(false);
    expect(existsSync(join(ROOT, 'src/presentation/components/Icon.astro'))).toBe(false);
    expect(existsSync(join(ROOT, 'src/presentation/visual/category-icons.ts'))).toBe(false);
  });

  it('redirects the old URL permanently, with 301 and not 308', () => {
    const config = read('astro.config.mjs');
    expect(config).toMatch(/'\/categories':\s*\{[^}]*status:\s*301/s);
    expect(config).toMatch(/destination:\s*'\/offers'/);
  });

  it('sends nobody there any more', () => {
    for (const f of sources) {
      expect(read(f), f).not.toMatch(/href=["'`]\/categories|href:\s*['"`]\/categories/);
    }
  });

  it('keeps the other legacy route as it is', () => {
    // /category/<slug> still 301s onto the filtered register
    expect(existsSync(join(ROOT, 'src/pages/category/[category].astro'))).toBe(true);
  });
});
