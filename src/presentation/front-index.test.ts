import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ATTRIBUTES } from '@domain/offers/attributes';

// The front index (Visual Direction v3 §1, plan §4): `/` is the head of the
// register, not a marketing page. It shows the same rows in the same order,
// hands over to `/offers`, and says only what the data supports.

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');
const home = read('src/pages/index.astro');
const register = read('src/pages/offers/index.astro');

describe('one register, one order', () => {
  it('takes its sample from the shared comparator and ranks nothing itself', () => {
    expect(home).toMatch(/defaultRegisterOrder/);
    expect(register).toMatch(/defaultRegisterOrder/);
    // it may sort — with the shared comparator and nothing else
    expect(home.match(/\.sort\([^)]*\)/g) ?? []).toEqual(['.sort(defaultRegisterOrder)']);
    expect(home).not.toMatch(/sortOffers/);
  });

  it('renders that sample through the register row, with no home-only props', () => {
    expect(home).toMatch(/<EntryRow entry=\{[^}]+\}\s*\/>/);
    expect(home).not.toMatch(/<EntryRow[^>]*(home|featured|compact|variant|sample)/i);
  });

  it('never reads the featured flag', () => {
    expect(home).not.toMatch(/\.featured\b/);
    expect(home).not.toMatch(/sortOffers/); // the one sort that ranks by it
  });

  it('hands over to the register through the route contract', () => {
    expect(home).toMatch(/registerHref\(\)/);
    expect(home).not.toContain('href="/offers"');
  });

  it('reads its status line from the one source', () => {
    for (const [name, src] of [['home', home], ['register', register]] as const) {
      expect(src, name).toMatch(/registerStatus\(/);
    }
    // no page keeps its own copy of that sentence
    expect(register).not.toMatch(/last checked \$\{|lastCheckLabel/);
  });

  it('counts the scoring criteria instead of printing a number that can rot', () => {
    expect(home).toMatch(/ATTRIBUTES\.length/);
    expect(home).not.toMatch(/\b(fifteen|sixteen|15|16) (named )?criteria/i);
    expect(ATTRIBUTES.length).toBeGreaterThan(0);
  });
});

describe('the home surface carries no legacy composition', () => {
  // scoped to this page: the hero machinery still serves 404, and the card
  // model still serves the record's related list until their packages land
  it('imports none of the retired home components', () => {
    for (const legacy of ['HeroField', 'CategoryExplorer', 'Pipeline', 'OfferPreview', 'CategoryCard']) {
      expect(home, legacy).not.toMatch(new RegExp(`import ${legacy}`));
    }
  });

  it('keeps no hero markup, motion markers or hero prop', () => {
    expect(home).not.toMatch(/hero|data-split|data-reveal|data-enter/i);
    expect(read('src/presentation/layouts/Layout.astro')).not.toMatch(/hero/i);
  });

  it('leaves no orphaned hero rules behind in the public stylesheet', () => {
    const css = read('src/styles/paper.css');
    for (const orphan of ['hero-wordmark', 'hero-mark', 'hero-word-rise', 'meridian']) {
      expect(css, orphan).not.toContain(orphan);
    }
    // …while keeping what 404 still uses
    expect(css).toContain('hero-field');
    expect(css).toContain('split-word');
  });
});

describe('search and SEO survive the rewrite', () => {
  it('stays prerendered with its metadata and structured data', () => {
    expect(home).not.toMatch(/export const prerender = false/);
    expect(home).toMatch(/jsonLd/);
    expect(home).toMatch(/<Layout[\s\S]*?title=/);
    expect(home).toMatch(/description=/);
  });
});
