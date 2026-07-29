#!/usr/bin/env node
// Portable, reviewable content export. Reads public catalogue rows with the anon
// key; internal evidence/click data belongs in encrypted pg_dump backups instead.
//
// Writes TWO files:
//
//   supabase/seed/content.json  — committed. The catalogue is the product, and
//     until this existed it lived in exactly one place: the live Supabase
//     project. Losing that project lost every offer, with no way to rebuild.
//     This is only published rows read through the anon key — the same data the
//     site already serves to the public — so it carries nothing secret.
//
//   backups/studely-content-<ts>.json — gitignored, 0600. A dated snapshot for
//     point-in-time recovery, kept out of git so history doesn't bloat.

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';

try { process.loadEnvFile('.env'); } catch {}
const url = process.env.PUBLIC_SUPABASE_URL;
const key = process.env.PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error('PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY are required.');
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const [{ data: categories, error: categoryError }, { data: offers, error: offerError }] = await Promise.all([
  db.from('categories').select('*').order('position').order('slug'),
  db.from('offers').select('*,offer_attributes(key,label,points)').eq('visibility', 'published').order('slug'),
]);
if (categoryError) throw new Error(`Failed to export categories: ${categoryError.message}`);
if (offerError) throw new Error(`Failed to export offers: ${offerError.message}`);
if (!offers?.length) throw new Error('Refusing to export an empty published catalogue.');

const exportedAt = new Date().toISOString();
const body = {
  schemaVersion: 1,
  source: 'public RLS view; drafts, profiles, evidence and analytics excluded',
  categories,
  offers,
};

// Committed copy. `exportedAt` is deliberately NOT in this file: a timestamp that
// changes on every run would make the seed dirty in git even when the catalogue
// is byte-identical, and a seed that is always dirty stops getting reviewed.
await mkdir(join('supabase', 'seed'), { recursive: true });
const seedFile = join('supabase', 'seed', 'content.json');
await writeFile(seedFile, JSON.stringify(body, null, 2) + '\n');

// Dated private snapshot.
await mkdir('backups', { recursive: true });
const snapshot = join('backups', `studely-content-${exportedAt.replace(/[:.]/g, '-')}.json`);
await writeFile(snapshot, JSON.stringify({ exportedAt, ...body }, null, 2), { mode: 0o600 });

console.log(`${categories?.length ?? 0} categories · ${offers.length} offers`);
console.log(`  committed seed → ${seedFile}`);
console.log(`  private snapshot → ${snapshot}`);
