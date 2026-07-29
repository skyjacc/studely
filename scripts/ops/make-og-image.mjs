#!/usr/bin/env node
// Generates public/og-default.png — the link preview card used by every page.
//
// It is generated rather than hand-designed so it cannot drift from the brand:
// the wordmark path is read straight out of Wordmark.astro, and the colours come
// from the same tokens as the site. Re-run after a logo or palette change.
//
// Deliberately typography-free: Schibsted Grotesk is not installed system-wide,
// and librsvg (behind sharp) will not reliably honour an embedded webfont, so any
// text here would silently render in a fallback face. The wordmark is a path and
// always renders exactly. Title and description are supplied by the OG tags
// beside the image anyway.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import sharp from 'sharp';

const BG = '#080807';       // --bg
const INK = '#e8e8e3';      // --ink
const HAIRLINE = '#26251f'; // --border over --bg, flattened

const source = await readFile('src/presentation/components/Wordmark.astro', 'utf8');
const viewBox = source.match(/viewBox="([^"]+)"/)?.[1];
const path = source.match(/<path d="([^"]+)"/)?.[1];
if (!viewBox || !path) {
  console.error('Could not read the wordmark path out of Wordmark.astro — did its markup change?');
  process.exit(1);
}

const [vx, vy, vw, vh] = viewBox.split(/\s+/).map(Number);

const W = 1200;
const H = 630;
const markW = 560;                       // wordmark width on the card
const markH = (markW * vh) / vw;
const markX = (W - markW) / 2;
const markY = (H - markH) / 2 - 8;       // nudge up; the rule below balances it
const scale = markW / vw;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${BG}"/>
  <rect x="40" y="40" width="${W - 80}" height="${H - 80}" fill="none" stroke="${HAIRLINE}" stroke-width="1"/>
  <g transform="translate(${markX} ${markY}) scale(${scale}) translate(${-vx} ${-vy})">
    <path d="${path}" fill="${INK}" fill-rule="evenodd"/>
  </g>
  <rect x="${(W - 96) / 2}" y="${markY + markH + 44}" width="96" height="2" fill="${INK}" opacity="0.55"/>
</svg>`;

await mkdir('public', { recursive: true });
await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile('public/og-default.png');

const { size } = await sharp('public/og-default.png').metadata().then(async (m) => ({
  size: (await readFile('public/og-default.png')).length,
  ...m,
}));
console.log(`public/og-default.png — ${W}x${H}, ${(size / 1024).toFixed(1)} KB`);
