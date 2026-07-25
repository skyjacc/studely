#!/usr/bin/env node
// Auto-checker: reads every published offer from Supabase, fetches its official
// URL, writes link-report.json, and (when SUPABASE_SERVICE_ROLE_KEY is present)
// records the whole run atomically through record_link_check_batch(jsonb).

import { writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { classifyOfferCheck, dedupeWrites } from '../src/domain/verification/link-check.ts';
import { fetchLinkWithRetry } from '../src/domain/verification/fetch-link.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CONCURRENCY = 6;

try {
  process.loadEnvFile(join(ROOT, '.env'));
} catch {
  // No .env in CI — use workflow environment.
}

const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing PUBLIC_SUPABASE_URL / PUBLIC_SUPABASE_ANON_KEY — cannot read offers.');
  process.exitCode = 1;
} else {
  const readDb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const writeDb = SERVICE_KEY
    ? createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
    : null;

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

  const { data: rows, error } = await readDb
    .from('offers')
    .select('id,slug,title,url,expires_at,status')
    .eq('visibility', 'published')
    .order('slug');

  if (error) {
    console.error(`Failed to load offers from Supabase: ${error.message}`);
    process.exitCode = 1;
  } else if (!rows?.length) {
    console.error('Supabase returned 0 published offers — refusing to report false success.');
    process.exitCode = 1;
  } else {
    const offers = rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      title: r.title ?? '(untitled)',
      url: r.url ?? null,
      expires: r.expires_at ?? null,
      status: r.status,
    }));
    const checkedAt = new Date();

    console.log(`Checking ${offers.length} offers…\n`);

    const results = await pool(
      offers,
      async (offer) => {
        const observation = offer.url
          ? await fetchLinkWithRetry(offer.url)
          : { status: 0, error: 'missing url' };
        const classified = classifyOfferCheck(offer, observation, checkedAt);
        const icon =
          classified.reportStatus === 'ok'
            ? '✓'
            : classified.reportStatus === 'BLOCKED' || classified.reportStatus === 'UNREACHABLE'
              ? '⚠'
              : '✗';
        console.log(`${icon} [${classified.reportStatus}] ${offer.title}`);
        console.log(
          `   ${offer.url ?? '(no url)'} ${observation.status ? `→ ${observation.status}` : ''}` +
            `${observation.error ? ` (${observation.error})` : ''}`,
        );
        return { ...offer, observation, ...classified };
      },
      CONCURRENCY,
    );

    const writes = dedupeWrites(results.map((r) => r.write));

    // Circuit breaker. A result with no HTTP status at all is a network-level
    // failure — which, if the runner itself lost DNS or egress, is every offer at
    // once. Writing that batch would stamp the whole directory as broken on the
    // strength of our own outage, and the site would tell students that healthy
    // offers are dead. Past a majority, refuse to write and let the run fail
    // loudly instead; a genuinely dead provider set does not appear in one run.
    const networkFailures = results.filter((r) => !r.observation?.status).length;
    const massFailure = results.length >= 3 && networkFailures > results.length / 2;

    let writeBack = { status: 'skipped', reason: 'SUPABASE_SERVICE_ROLE_KEY is not configured.' };
    if (massFailure) {
      const reason =
        `${networkFailures}/${results.length} offers failed at the network level — ` +
        'refusing to write. This looks like a runner/network outage, not dead offers.';
      console.error(`\n${reason}`);
      writeBack = { status: 'aborted', reason };
      process.exitCode = 1;
    } else if (writeDb) {
      const { error: writeError } = await writeDb.rpc('record_link_check_batch', { checks: writes });
      if (writeError) {
        console.error(`Failed to write verification results: ${writeError.message}`);
        writeBack = { status: 'failed', reason: writeError.message };
        process.exitCode = 1;
      } else {
        writeBack = { status: 'written', rows: writes.length };
      }
    } else {
      console.warn('\nWrite-back skipped: SUPABASE_SERVICE_ROLE_KEY is not configured.');
    }

    const blocked = results.filter((r) => r.reportStatus === 'BLOCKED');
    // Unreachable is a warning, not a problem: we failed to get an answer, which
    // is not evidence the offer is gone. Listed separately so a link that is
    // unreachable week after week is still visible and can be checked by hand.
    const unreachable = results.filter((r) => r.reportStatus === 'UNREACHABLE');
    const problems = results.filter((r) => r.reportStatus === 'DEAD' || r.reportStatus === 'EXPIRED');
    const report = {
      checkedAt: checkedAt.toISOString(),
      total: results.length,
      ok: results.filter((r) => r.reportStatus === 'ok').length,
      blocked: blocked.map((r) => ({ slug: r.slug, title: r.title, url: r.url, http: r.observation.status })),
      unreachable: unreachable.map((r) => ({ slug: r.slug, title: r.title, url: r.url, error: r.observation.error ?? null })),
      problems: problems.map((r) => ({
        slug: r.slug,
        title: r.title,
        url: r.url,
        status: r.reportStatus,
        http: r.observation.status || null,
        error: r.observation.error ?? null,
      })),
      writeBack,
    };
    await writeFile(join(ROOT, 'link-report.json'), JSON.stringify(report, null, 2));

    console.log(
      `\n${report.ok}/${report.total} healthy · ${blocked.length} bot-blocked · ` +
        `${unreachable.length} unreachable · ${problems.length} need attention · ` +
        `DB ${writeBack.status} → link-report.json`,
    );
    if (problems.length > 0) process.exitCode = 1;
  }
}
