import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// The motion budget as a test (Visual Direction v2 §08, owner 2026-09-21):
// no smooth-scroll library, no animation library, no WebGL library on the
// public site; reveals hide content only once JS has booted, and reduced
// motion bypasses them entirely.

const ROOT = process.cwd();
const walk = (dir: string, out: string[] = []): string[] => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(astro|ts|mjs|css)$/.test(name) && !/\.test\.ts$/.test(name)) out.push(p);
  }
  return out;
};
const SRC = walk(join(ROOT, 'src'));
const read = (p: string) => readFileSync(p, 'utf8');

const BANNED = [/from ['"]gsap/, /from ['"]lenis/, /from ['"]three/, /import\(['"]three['"]\)/];

describe('motion budget', () => {
  it('ships no gsap, lenis or three anywhere in src', () => {
    const offenders = SRC.filter((p) => BANNED.some((re) => re.test(read(p)))).map((p) => p.replace(ROOT + '/', ''));
    expect(offenders).toEqual([]);
  });

  it('lists none of them as a dependency', () => {
    const pkg = JSON.parse(read(join(ROOT, 'package.json')));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    for (const name of ['gsap', 'lenis', 'three', '@types/three']) expect(deps, `${name} still in package.json`).not.toHaveProperty(name);
  });

  it('has no custom cursor and no dot-field shader left', () => {
    const files = SRC.map((p) => p.replace(ROOT + '/', ''));
    expect(files.some((f) => /Cursor\.astro$/.test(f))).toBe(false);
    expect(files.some((f) => /dot-field\.ts$/.test(f))).toBe(false);
    expect(files.some((f) => /Hero3D\.astro$/.test(f))).toBe(false);
  });

  it('hides reveal targets only under html.js-motion, and never under reduced motion', () => {
    const css = read(join(ROOT, 'src/styles/global.css'));
    // every rule that sets opacity: 0 on a reveal target must be scoped to html.js-motion
    const hidden = [...css.matchAll(/^([^\n{]*\[data-(?:reveal|enter|reveal-group)\][^\n{]*)\{[^}]*opacity:\s*0/gm)].map((m) => m[1].trim());
    expect(hidden.length).toBeGreaterThan(0);
    for (const sel of hidden) expect(sel, sel).toMatch(/^html\.js-motion/);
    // and the reduced-motion block restores them
    const rm = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
    expect(rm).toMatch(/html\.js-motion \[data-reveal\][^}]*opacity:\s*1/);
  });
});
