import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RECORD_SECTIONS } from './record';

// The record page composes the model and nothing else: no second derivation of
// score or trust, no card model, and the six questions in the order the model
// names. What it renders from production data is checked in the browser.

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');
const page = read('src/pages/offers/[id].astro');
const box = read('src/presentation/components/RecordBox.astro');
const styleOf = (src: string) => [...src.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');

describe('one derivation', () => {
  it('builds the page from the record model', () => {
    expect(page).toMatch(/recordModel\(/);
  });

  it('recomputes neither the score nor the trust facts', () => {
    for (const [name, src] of [['page', page], ['box', box]] as const) {
      expect(src, name).not.toMatch(/deriveTrust|scoreWord|scoreTier|formatScore|describeScore|formatTrustDate|headlineState/);
    }
  });

  it('reaches the register and the provider through the contracts', () => {
    expect(page).not.toContain('/offers/${');
    expect(page).not.toMatch(/href=["'`]\/go\//);
    expect(page).toMatch(/registerHref|recordHref|categoryHref/);
  });
});

describe('the record is not a card', () => {
  it('renders the header, the related list and nothing else as offer cards', () => {
    expect(page).not.toMatch(/import OfferPreview|import Logo|logo-tile|grid-offers/);
    expect(page).toMatch(/import EntryRow/);
  });

  // The six markers span the page and the box it embeds, so their real order is
  // a DOM fact and is asserted in the browser. Here: each one exists exactly
  // once, and the ones written in the same file are written in order.
  it('marks all six questions, once each', () => {
    const src = page + box;
    for (const q of RECORD_SECTIONS) {
      expect(src.match(new RegExp(`data-q="${q}"`, 'g')) ?? [], q).toHaveLength(1);
    }
  });

  it('keeps the questions it owns in order', () => {
    const at = (q: string) => page.indexOf(`data-q="${q}"`);
    const positions = ['what is it', 'what do I get'].map(at);
    expect(positions.every((i) => i > -1)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    const inBox = ['who qualifies', 'why trust it', 'what do I do', 'where does it go'].map((q) => box.indexOf(`data-q="${q}"`));
    expect(inBox.every((i) => i > -1)).toBe(true);
    expect([...inBox].sort((a, b) => a - b)).toEqual(inBox);
  });

  it('shows no length signal of any kind', () => {
    expect(page).not.toMatch(/\bWORDS\b|wordCount|readingTime|minutes? read/i);
  });
});

describe('the two trust layers stay apart', () => {
  it('gives the human layer and the check their own rows in the box', () => {
    expect(box).toMatch(/Human verification/i);
    expect(box).toMatch(/Link checked/i);
    // the box reads the model's own slots rather than choosing one to show
    expect(box).toMatch(/box\.human/);
    expect(box).toMatch(/box\.check/);
    expect(box).toMatch(/box\.status/);
  });

  it('never writes the word Unverified', () => {
    for (const [name, src] of [['page', page], ['box', box]] as const) {
      expect(src, name).not.toMatch(/unverified/i);
    }
  });
});

describe('the action', () => {
  it('states where it goes and what it earns, under the button', () => {
    expect(box).toMatch(/destinationHost/);
    expect(box).toMatch(/action\.money/);
  });

  it('keeps the outbound link usable on a phone without covering the page', () => {
    const narrow = styleOf(page) + styleOf(box);
    expect(narrow).toMatch(/@media \(max-width: (9|8|7)\d\dpx\)[\s\S]*?position:\s*sticky|position:\s*fixed/);
  });
});

describe('what the rewrite must not lose', () => {
  it('keeps the metadata and the structured data', () => {
    expect(page).toMatch(/jsonLd/);
    expect(page).toMatch(/'@type': 'Product'/);
    expect(page).toMatch(/BreadcrumbList/);
    expect(page).toMatch(/noindex=\{isExpired/);
  });

  it('keeps the in-article ad slot where it was', () => {
    expect(page).toMatch(/AdSlot[^>]*in-article/);
  });
});
