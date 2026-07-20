#!/usr/bin/env node
// Fast structural check of offer frontmatter (runs without a full Astro build).
// Astro's zod schema is the source of truth at build time; this is a quick
// pre-commit sanity pass. Exit 1 on any missing required field.

import { readdir, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OFFERS_DIR = join(ROOT, 'src', 'content', 'offers');

// Keep in sync with src/data/categories.ts (the build-time source of truth).
const categorySlugs = [
  'dev-tools', 'design', 'cloud', 'ai', 'learning',
  'domains', 'productivity', 'entertainment', 'hardware', 'finance',
];

const REQUIRED = ['title', 'provider', 'category', 'summary', 'value', 'offerType', 'url', 'verification', 'lastChecked'];
const OFFER_TYPES = ['free', 'discount', 'credit', 'trial'];

function fm(block, key) {
  const m = block.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
  return m ? m[1].trim().replace(/^["']|["']$/g, '') : undefined;
}

const files = (await readdir(OFFERS_DIR)).filter((f) => f.endsWith('.md'));
let errors = 0;

for (const f of files) {
  const raw = await readFile(join(OFFERS_DIR, f), 'utf8');
  const m = raw.match(/^---\n([\s\S]*?)\n---/);
  if (!m) { console.error(`✗ ${f}: no frontmatter`); errors++; continue; }
  const block = m[1];
  const problems = [];

  for (const key of REQUIRED) if (!fm(block, key)) problems.push(`missing "${key}"`);

  const cat = fm(block, 'category');
  if (cat && !categorySlugs.includes(cat)) problems.push(`unknown category "${cat}"`);

  const type = fm(block, 'offerType');
  if (type && !OFFER_TYPES.includes(type)) problems.push(`invalid offerType "${type}"`);

  const url = fm(block, 'url');
  if (url && !/^https?:\/\//.test(url)) problems.push(`url not http(s): "${url}"`);

  if (problems.length) { console.error(`✗ ${f}: ${problems.join(', ')}`); errors += problems.length; }
  else console.log(`✓ ${f}`);
}

console.log(`\n${files.length} offers checked · ${errors} problem(s)`);
if (errors) process.exit(1);
