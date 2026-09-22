import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Two presentation surfaces, one base. The public site is "paper" (Visual
// Direction v3); the admin is an operator tool with its own palette. They share
// only src/styles/base.css — reset, type and space scales, a11y utilities —
// which is colour-agnostic and names the semantic tokens each surface must
// supply. A public token change can therefore never restyle the admin, and an
// admin change never leaks onto the register.

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');
const walk = (dir: string, out: string[] = []): string[] => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(astro|css|ts)$/.test(name)) out.push(p.replace(ROOT + '/', ''));
  }
  return out;
};
const SRC = walk(join(ROOT, 'src'));
const isAdmin = (f: string) =>
  f.startsWith('src/pages/admin/') || f.startsWith('src/presentation/components/admin/') ||
  f === 'src/presentation/layouts/AdminLayout.astro' || f === 'src/styles/admin.css';

const rootBlock = (css: string) => {
  const i = css.indexOf(':root {');
  if (i < 0) throw new Error(':root missing');
  return css.slice(i, css.indexOf('}', i));
};
const declared = (block: string) => new Set([...block.matchAll(/(--[a-z0-9-]+):/g)].map((m) => m[1]));

const COLOUR_TOKEN = /^--(bg|bg-alt|surface|surface-2|ink|ink-rgb|text|text-muted|rule|rule-[a-z-]+|border|border-[a-z-]+|accent|accent-[a-z-]+|pop|pop-ink|spon-[a-z]+|state-[a-z-]+|shadow-[a-z-]+)$/;

describe('base is colour-agnostic', () => {
  const base = read('src/styles/base.css');
  it('declares no colour token and no literal colour in :root', () => {
    const block = rootBlock(base);
    const colours = [...declared(block)].filter((t) => COLOUR_TOKEN.test(t));
    expect(colours).toEqual([]);
    expect(block).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/i);
  });
  it('is satisfied by every surface: each semantic colour token base consumes is declared by paper and by admin', () => {
    const consumed = [...new Set([...base.matchAll(/var\((--[a-z0-9-]+)/g)].map((m) => m[1]))]
      .filter((t) => COLOUR_TOKEN.test(t));
    expect(consumed.length).toBeGreaterThan(0);
    for (const surface of ['src/styles/paper.css', 'src/styles/admin.css']) {
      const have = declared(rootBlock(read(surface)));
      for (const t of consumed) expect(have.has(t), `${surface} must declare ${t}`).toBe(true);
    }
  });
});

describe('import graph', () => {
  it('has no global.css left to import by accident', () => {
    expect(existsSync(join(ROOT, 'src/styles/global.css'))).toBe(false);
  });
  it('paper.css enters only through the public Layout; admin.css only through AdminLayout', () => {
    const importers = (sheet: string) => SRC.filter((f) => f.endsWith('.astro') && new RegExp(`styles/${sheet}'`).test(read(f)));
    expect(importers('paper.css')).toEqual(['src/presentation/layouts/Layout.astro']);
    expect(importers('admin.css')).toEqual(['src/presentation/layouts/AdminLayout.astro']);
    expect(importers('base.css')).toEqual([]); // base rides in via each surface's @import
    expect(read('src/styles/paper.css')).toMatch(/@import\s+'\.\/base\.css'/);
    expect(read('src/styles/admin.css')).toMatch(/@import\s+'\.\/base\.css'/);
  });
  it('admin files import no public presentation component (brand assets excepted)', () => {
    const offenders: string[] = [];
    for (const f of SRC.filter(isAdmin).filter((f) => f.endsWith('.astro'))) {
      for (const m of read(f).matchAll(/from '(?:@ui|\.\.?\/[./]*)\/?components\/([A-Za-z/]+)\.astro'/g)) {
        if (!/^(admin\/|Wordmark$|Logo$)/.test(m[1])) offenders.push(`${f} → ${m[1]}`);
      }
    }
    expect(offenders).toEqual([]);
  });
  it('admin markup depends on no paper class: every paper class it uses is redefined in its own <style>', () => {
    // paper's class vocabulary, derived — not a hand list, so it tracks paper.css
    const paperClasses = new Set([...read('src/styles/paper.css').matchAll(/^\s*\.([a-zA-Z0-9_-]+)/gm)].map((m) => m[1]));
    const offenders: string[] = [];
    for (const f of SRC.filter(isAdmin).filter((f) => f.endsWith('.astro'))) {
      const src = read(f);
      const style = [...src.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');
      const markup = src.replace(/<style[\s\S]*?<\/style>/g, '').replace(/^---[\s\S]*?---/, '');
      const used = new Set<string>();
      for (const m of markup.matchAll(/class(?::list)?=(?:"([^"]*)"|\{([^}]*)\})/g)) {
        for (const c of (m[1] ?? m[2]).match(/[a-zA-Z][a-zA-Z0-9_-]*/g) ?? []) if (paperClasses.has(c)) used.add(c);
      }
      for (const c of used) {
        const own = new RegExp(`(^|[\\s,{}])\\.${c}(?![a-zA-Z0-9_-])`, 'm').test(style);
        if (!own) offenders.push(`${f}: .${c} comes from paper.css`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
