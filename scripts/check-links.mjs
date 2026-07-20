#!/usr/bin/env node
// Auto-checker: fetches every offer URL and flags dead links + expired offers.
// Run locally with `npm run check-links`, or on a schedule via GitHub Actions.
// Exit code 1 if any link is dead or any offer expired (fails CI).

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OFFERS_DIR = join(ROOT, 'src', 'content', 'offers');
const TIMEOUT_MS = 15_000;
const CONCURRENCY = 6;

/** Pull a scalar value for `key` out of a YAML frontmatter block. */
function fm(block, key) {
  const m = block.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
  if (!m) return undefined;
  return m[1].trim().replace(/^["']|["']$/g, '');
}

function parseOffer(raw) {
  const m = raw.match(/^---\n([\s\S]*?)\n---/);
  const block = m ? m[1] : '';
  return {
    title: fm(block, 'title') ?? '(untitled)',
    url: fm(block, 'url'),
    expires: fm(block, 'expires') ?? 'ongoing',
    lastChecked: fm(block, 'lastChecked'),
  };
}

// A realistic browser UA cuts down on false 403s from anti-bot walls.
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';
// Codes that mean "server is up but is refusing the bot" — not a broken link.
const BLOCKED_CODES = new Set([401, 403, 405, 406, 429]);

async function checkUrl(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    // Some hosts reject HEAD; GET is more reliable. We don't read the body.
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: ctrl.signal,
      headers: {
        'user-agent': UA,
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'accept-language': 'en-US,en;q=0.9',
      },
    });
    const kind = res.status < 400 ? 'ok' : BLOCKED_CODES.has(res.status) ? 'blocked' : 'dead';
    return { kind, status: res.status, finalUrl: res.url };
  } catch (err) {
    return { kind: 'dead', status: 0, error: err?.name === 'AbortError' ? 'timeout' : String(err?.message || err) };
  } finally {
    clearTimeout(timer);
  }
}

function isExpired(expires) {
  if (!expires || expires === 'ongoing') return false;
  const t = Date.parse(expires);
  return !Number.isNaN(t) && t < Date.now();
}

async function pool(items, worker, size) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await worker(items[idx], idx);
      }
    }),
  );
  return out;
}

const files = (await readdir(OFFERS_DIR)).filter((f) => f.endsWith('.md'));
const offers = await Promise.all(
  files.map(async (f) => ({ file: f, ...parseOffer(await readFile(join(OFFERS_DIR, f), 'utf8')) })),
);

console.log(`Checking ${offers.length} offers…\n`);

const results = await pool(
  offers,
  async (o) => {
    const link = o.url ? await checkUrl(o.url) : { kind: 'dead', status: 0, error: 'missing url' };
    const expired = isExpired(o.expires);
    const status = expired ? 'EXPIRED' : link.kind === 'ok' ? 'ok' : link.kind === 'blocked' ? 'BLOCKED' : 'DEAD';
    const icon = status === 'ok' ? '✓' : status === 'BLOCKED' ? '⚠' : '✗';
    console.log(`${icon} [${status}] ${o.title}`);
    console.log(`   ${o.url ?? '(no url)'} ${link.status ? `→ ${link.status}` : ''}${link.error ? ` (${link.error})` : ''}`);
    return { ...o, link, expired, status };
  },
  CONCURRENCY,
);

// BLOCKED = live site refusing the bot (403/429/…). Reported as a warning but
// does NOT fail CI. Only dead links and expired offers are real problems.
const blocked = results.filter((r) => r.status === 'BLOCKED');
const problems = results.filter((r) => r.status === 'DEAD' || r.status === 'EXPIRED');
const report = {
  checkedAt: new Date().toISOString(),
  total: results.length,
  ok: results.filter((r) => r.status === 'ok').length,
  blocked: blocked.map((p) => ({ file: p.file, title: p.title, url: p.url, http: p.link.status })),
  problems: problems.map((p) => ({ file: p.file, title: p.title, url: p.url, status: p.status, http: p.link.status, error: p.link.error })),
};
await writeFile(join(ROOT, 'link-report.json'), JSON.stringify(report, null, 2));

console.log(
  `\n${report.ok}/${report.total} healthy · ${blocked.length} bot-blocked (ok) · ${problems.length} need attention → link-report.json`,
);
if (problems.length > 0) process.exit(1);
