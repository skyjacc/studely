import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// The admin overview displays dashboardMetrics and decides nothing. The review
// this file exists for is not "are the numbers right" — the metric layer's
// fixtures answer that — but "has the business logic leaked back into the page".
//
// Contract: studely-vault/Design/Dashboard metric contract.md

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');
const page = read('src/pages/admin/index.astro');
/** The markup lives in the component; the page reads rows and hands them over. */
const overview = read('src/presentation/components/admin/Overview.astro');
const rendered = page + overview;
/** Comments explain the rules; only code may not restate them. */
const code = page.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('the page displays and does not decide', () => {
  it('reads its numbers from the metric layer', () => {
    expect(page).toMatch(/dashboardMetrics\(/);
  });

  it('recomputes none of them — not in the page and not in the markup', () => {
    // every rule the metrics already own
    const both = code + overview.replace(/<!--[\s\S]*?-->/g, '').replace(/^\s*\/\/.*$/gm, '');
    for (const rule of ['deriveTrust', 'hasExpired', 'isStale', 'problemWords', 'STALE_AFTER_DAYS']) {
      expect(both, rule).not.toContain(rule);
    }
  });

  it('keeps no threshold and no status test of its own', () => {
    expect(code).not.toMatch(/7 \* 24|14 \* 24|days? ?\* ?86_?400|staleCutoff/);
    expect(code).not.toMatch(/status\s*===?\s*['"]expired['"]|eq\(['"]status['"],\s*['"]expired['"]\)/);
  });

  it('counts nothing in the page that the layer already counts', () => {
    // no `.filter(...).length` arithmetic over offers in the template
    expect(code).not.toMatch(/\.filter\([^)]*\)\.length/);
  });
});

describe('zero is a state, not an absence', () => {
  it('shows Verified and Unchecked whatever they are', () => {
    for (const label of ['Verified', 'Unchecked']) expect(rendered, label).toContain(label);
    // neither may be rendered behind a "> 0" guard
    expect(rendered).not.toMatch(/verified\s*>\s*0\s*&&/);
    expect(rendered).not.toMatch(/unchecked\s*>\s*0\s*&&/);
  });

  it('never prints a dash where a count belongs', () => {
    expect(rendered).not.toMatch(/\?\?\s*['"]—['"]|\|\|\s*['"]—['"]/);
  });
});

describe('the retired assumptions are gone', () => {
  it('shows no queue for a feature with no write path', () => {
    for (const dead of ['Submissions waiting', 'Comments to moderate', 'submissions', 'comments']) {
      expect(code, dead).not.toContain(dead);
      expect(overview, dead).not.toContain(dead);
    }
  });

  it('no longer calls a check stale after seven days', () => {
    // "7 days" is a legitimate label for the outbound window; what may not
    // come back is a staleness claim keyed to it
    expect(rendered).not.toMatch(/Not checked in 7 days/);
    expect(rendered).not.toMatch(/[Ss]tale[^<]{0,40}7 days/);
  });
});

describe('what it says about the money', () => {
  it('has no revenue, conversion or traffic section', () => {
    expect(rendered).not.toMatch(/revenue|conversion|\bEPC\b|\bCTR\b|sessions/i);
  });

  it('calls the outbound figure what it counts', () => {
    expect(rendered).toMatch(/Outbound requests/);
    // the reader sees labels, not identifiers: `offer_clicks` is the table it
    // reads, and may appear; "Clicks" as a heading or a tile label may not
    const labels = [...overview.matchAll(/<span class="l">([^<]*)<\/span>/g)].map((m) => m[1]);
    const headings = [...overview.matchAll(/<h2 class="hd">([^<]*)<\/h2>/g)].map((m) => m[1]);
    for (const text of [...labels, ...headings]) {
      expect(text, text).not.toMatch(/\bclicks?\b|\bvisitors?\b|\btraffic\b|\busers?\b/i);
    }
  });
});
