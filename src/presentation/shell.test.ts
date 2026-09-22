import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// The paper-register shell as a contract (Visual Direction v3 §5–§8). Paper is
// the only public surface; hairlines are drawn from ink, never from a light
// value over a dark ground; the masthead is wordmark · Search · About; the
// footer is one line. These tests read the source, so they hold on every build.

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');
const walk = (dir: string, out: string[] = []): string[] => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(astro|css)$/.test(name)) out.push(p);
  }
  return out;
};

// ---- helpers: read a token from :root and measure WCAG contrast --------------
const css = read('src/styles/paper.css');
const rootBlock = css.slice(css.indexOf(':root {'), css.indexOf('}', css.indexOf(':root {')));
const token = (name: string): string => {
  const m = rootBlock.match(new RegExp(`${name}:\\s*([^;]+);`));
  if (!m) throw new Error(`token ${name} missing from :root`);
  return m[1].trim();
};
const hex = (v: string): [number, number, number] => {
  const m = v.match(/^#([0-9a-f]{6})$/i);
  if (!m) throw new Error(`not a 6-digit hex: ${v}`);
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const lum = ([r, g, b]: [number, number, number]) => {
  const f = (c: number) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const contrast = (a: string, b: string) => {
  const [la, lb] = [lum(hex(a)), lum(hex(b))];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};
/** alpha of ink over paper, flattened to a hex, for rule/control contrast */
const over = (ink: string, paper: string, alpha: number): string => {
  const i = hex(ink), p = hex(paper);
  const c = i.map((v, k) => Math.round(v * alpha + p[k] * (1 - alpha)));
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
};

describe('paper tokens', () => {
  it('declares a light colour scheme with paper lighter than ink', () => {
    expect(rootBlock).toMatch(/color-scheme:\s*light/);
    expect(lum(hex(token('--bg')))).toBeGreaterThan(lum(hex(token('--ink'))));
  });

  it('ships no shadow tokens and no film grain', () => {
    expect(rootBlock).not.toMatch(/--shadow-/);
    expect(css).not.toMatch(/body::after/);
  });

  it('never draws a hairline as a light value over a dark ground', () => {
    // 232,232,227 is the admin's beige ink; any alpha of it is invisible on paper.
    // The admin surface keeps it — that is its own palette (surfaces.test.ts).
    const isAdmin = (f: string) => /^src\/(pages\/admin\/|presentation\/components\/admin\/|presentation\/layouts\/AdminLayout\.astro|styles\/admin\.css)/.test(f);
    const offenders = walk(join(ROOT, 'src'))
      .map((p) => p.replace(ROOT + '/', ''))
      .filter((f) => !isAdmin(f))
      .filter((f) => /rgba\(\s*232\s*,\s*232\s*,\s*227/.test(read(f)));
    expect(offenders).toEqual([]);
  });

  it('holds WCAG contrast on paper', () => {
    const bg = token('--bg'), ink = token('--ink');
    expect(contrast(ink, bg)).toBeGreaterThanOrEqual(7);                       // body text AAA
    expect(contrast(token('--text-muted'), bg)).toBeGreaterThanOrEqual(4.5);    // secondary text AA
    expect(contrast(token('--state-warn-ink'), bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(token('--state-bad-ink'), bg)).toBeGreaterThanOrEqual(4.5);
    // interactive boundaries (WCAG 1.4.11): the control rule alpha over paper ≥ 3:1
    const a = Number(token('--rule-control-alpha'));
    expect(contrast(over(ink, bg, a), bg)).toBeGreaterThanOrEqual(3);
  });
});

describe('masthead', () => {
  const header = read('src/presentation/components/Header.astro');
  it('is wordmark · Search · About and nothing else', () => {
    expect(header).toMatch(/href="\/about"/);
    expect(header).toMatch(/data-palette-open/);
    expect(header).toMatch(/href="\/offers"[^>]*data-palette-open|data-palette-open[^>]*href="\/offers"/); // no-JS fallback
    expect(header).not.toMatch(/cta-btn|Browse offers|Browse deals/);
    expect(header).not.toMatch(/href="\/methodology"/); // How we score is not masthead navigation
  });
  it('has one state: solid paper with a rule — no transparency, no hide-on-scroll', () => {
    expect(header).not.toMatch(/data-state|data-hidden|heroPage|backdrop-filter/);
  });
});

describe('footer', () => {
  const footer = read('src/presentation/components/Footer.astro');
  it('is one line: identity · disclosure · utility links', () => {
    for (const href of ['/about', '/contact', '/legal/privacy', '/legal/terms', '/legal/cookies', '/legal/disclosure']) {
      expect(footer, href).toContain(`href: '${href}'`);
    }
    expect(footer).toMatch(/site\.affiliateDisclosure/);
    expect(footer).not.toMatch(/categories\.map|topCats|f-nav|footer-logo/);
    expect(footer).not.toMatch(/data-reveal/);
  });
});
