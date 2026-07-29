#!/usr/bin/env node
// Rebuilds the public catalogue from the committed seed (supabase/seed/content.json).
//
// This is the other half of export-seed: a seed nothing can restore is not a
// backup, it is a file. Run it against a fresh project after a migration reset,
// or against a disposable project to get a realistic local dataset.
//
// Idempotent — upserts on `slug`, so running it twice is a no-op rather than a
// duplicate catalogue. Attributes are replaced per offer, and the score is left
// to the database: inserting attribute rows fires the rescore trigger, so the
// restored score is derived exactly as it was originally, never copied in.

import { readFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';

try { process.loadEnvFile('.env'); } catch {}

const url = process.env.PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  console.error('The service-role key bypasses RLS — it is needed to write the catalogue.');
  process.exit(1);
}

// Writing the catalogue is destructive-ish (it overwrites rows by slug), so it
// never happens by accident — same guard style as scripts/ops/restore-db.sh.
if (process.env.CONFIRM_IMPORT !== 'IMPORT') {
  console.error('Refusing to write. Set CONFIRM_IMPORT=IMPORT once you have checked the target project.');
  console.error(`Target would be: ${url}`);
  process.exit(1);
}

const seed = JSON.parse(await readFile('supabase/seed/content.json', 'utf8'));
if (!seed.offers?.length) {
  console.error('Seed contains no offers — refusing to import an empty catalogue.');
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const fail = (label, error) => {
  if (!error) return;
  console.error(`${label}: ${error.message}`);
  process.exit(1);
};

// 1. Categories first — offers carry a foreign key onto them.
const categories = seed.categories.map(({ created_at, ...c }) => c);
fail('categories', (await db.from('categories').upsert(categories, { onConflict: 'slug' })).error);

// 2. Offers. `id` is preserved so click history and verification rows that
//    reference it still line up after a partial restore. `score` is dropped —
//    the database derives it from the attributes below.
const offers = seed.offers.map(({ offer_attributes, score, created_at, updated_at, created_by, ...o }) => o);
fail('offers', (await db.from('offers').upsert(offers, { onConflict: 'slug' })).error);

// 3. Attributes, replaced per offer so a re-run cannot accumulate duplicates.
const ids = seed.offers.map((o) => o.id);
fail('clear attributes', (await db.from('offer_attributes').delete().in('offer_id', ids)).error);

const attributes = seed.offers.flatMap((o) =>
  (o.offer_attributes ?? []).map((a) => ({ offer_id: o.id, key: a.key, label: a.label, points: a.points })),
);
if (attributes.length) {
  fail('attributes', (await db.from('offer_attributes').insert(attributes)).error);
}

// 4. Prove the restore rather than announcing it: read the scores back and check
//    they match what the seed recorded. A silent mismatch here would mean the
//    rescore path is broken, which is exactly what a restore must not hide.
const { data: restored, error: readError } = await db
  .from('offers')
  .select('slug,score')
  .in('slug', seed.offers.map((o) => o.slug));
fail('verify', readError);

const bySlug = new Map(restored.map((r) => [r.slug, r.score]));
const drift = seed.offers
  .filter((o) => bySlug.get(o.slug) !== o.score)
  .map((o) => `${o.slug}: seed ${o.score} -> restored ${bySlug.get(o.slug)}`);

console.log(`${categories.length} categories · ${offers.length} offers · ${attributes.length} attributes restored`);
if (drift.length) {
  console.error(`\nScore drift after restore (${drift.length}):`);
  drift.forEach((d) => console.error(`  ${d}`));
  process.exit(1);
}
console.log('Scores recomputed by the database match the seed exactly.');
