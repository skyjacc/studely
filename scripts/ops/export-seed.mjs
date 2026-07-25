#!/usr/bin/env node
// Portable, reviewable content export. Reads public catalogue rows with the anon
// key; internal evidence/click data belongs in encrypted pg_dump backups instead.

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

const output = {
  schemaVersion: 1,
  exportedAt: new Date().toISOString(),
  source: 'public RLS view; drafts, profiles, evidence and analytics excluded',
  categories,
  offers,
};
await mkdir('backups', { recursive: true });
const file = join('backups', `studely-content-${output.exportedAt.replace(/[:.]/g, '-')}.json`);
await writeFile(file, JSON.stringify(output, null, 2), { mode: 0o600 });
console.log(`${categories?.length ?? 0} categories · ${offers.length} offers → ${file}`);
