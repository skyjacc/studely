#!/usr/bin/env node
// Auto-checker: fetches every published offer URL and flags dead links + expired
// offers. Reads the offers straight from Supabase (the site's source of truth
// since the P1 DB-swap), not from Markdown. Run locally with `npm run check-links`,
// or on a schedule via GitHub Actions. Exit code 1 if any link is dead or any
// offer expired (fails CI).

import { writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TIMEOUT_MS = 15_000;
const CONCURRENCY = 6;

// Load .env for local runs; in CI the vars come from the workflow env, and there
// is no .env file — loadEnvFile throws in that case, which we ignore.
try {
  process.loadEnvFile(join(ROOT, '.env'));
} catch {
  // no .env — rely on the ambient environment (CI secrets)
}

const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.PUBLIC_SUPABASE_ANON_KEY;
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing PUBLIC_SUPABASE_URL / PUBLIC_SUPABASE_ANON_KEY — cannot read offers.');
  process.exit(1);
}

// The anon key reads published offers under RLS (offers_read_published), which is
// exactly the set that is live and worth checking.
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

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

const { data: rows, error } = await db
  .from('offers')
  .select('slug,title,url,expires_at')
  .eq('visibility', 'published');
if (error) {
  console.error(`Failed to load offers from Supabase: ${error.message}`);
  process.exit(1);
}

const offers = (rows ?? []).map((r) => ({
  slug: r.slug,
  title: r.title ?? '(untitled)',
  url: r.url,
  expires: r.expires_at ?? 'ongoing',
}));

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
  blocked: blocked.map((p) => ({ slug: p.slug, title: p.title, url: p.url, http: p.link.status })),
  problems: problems.map((p) => ({ slug: p.slug, title: p.title, url: p.url, status: p.status, http: p.link.status, error: p.link.error })),
};
await writeFile(join(ROOT, 'link-report.json'), JSON.stringify(report, null, 2));

console.log(
  `\n${report.ok}/${report.total} healthy · ${blocked.length} bot-blocked (ok) · ${problems.length} need attention → link-report.json`,
);
if (problems.length > 0) process.exit(1);
