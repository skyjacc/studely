# StudentPerks

Auto-curated directory of free tools, cloud credits, courses and discounts for students.
Built with **Astro 5** — static, fast, SEO-first, monetised with affiliate links, display ads and sponsored listings.

> Rename anytime: change `site.name` in `src/data/site.ts` and `site` in `astro.config.mjs`.

## Stack

- **Astro 5 + TypeScript** — static output, top Lighthouse (needed for AdSense approval + ranking)
- **Content collections** — each offer is one validated Markdown file (`src/content/offers/`)
- **Custom CSS design system** — `src/styles/global.css` (light/dark, editorial card grid)
- **Link-checker + GitHub Action** — the "auto-update" heartbeat

## Run

```bash
npm install
npm run dev        # http://localhost:4321
npm run build      # static site → dist/
npm run preview    # preview the build
```

Quality helpers:

```bash
npm run check          # Astro + TypeScript diagnostics
npm run validate-offers # fast frontmatter sanity check
npm run check-links    # fetch every offer URL, flag dead/expired → link-report.json
```

## Add an offer

Create `src/content/offers/<slug>.md`:

```markdown
---
title: Offer name
provider: Company
category: dev-tools        # see src/data/categories.ts for the 10 slugs
summary: One-line hook.
value: "$200k+ in tools"   # headline shown on the card
offerType: free            # free | discount | credit | trial
discountPercent: 50        # only for offerType: discount
url: https://…             # ← put your affiliate / referral link here
affiliate: false           # true adds rel="sponsored" + a disclosure
sponsored: false           # true = paid placement, sorted first, labelled
featured: true             # surfaces on the homepage
verification: SheerID
eligibility: Verified students worldwide
expires: ongoing           # ISO date (2026-12-31) or "ongoing"
lastChecked: 2026-07-19
tags: [github, bundle]
---

Markdown body = the offer detail page.
```

The build **fails** on an invalid offer (zod schema in `src/content.config.ts`), so broken data never ships.

## Monetisation

1. **Affiliate / referral** — put your tracked link in an offer's `url`, set `affiliate: true`.
2. **Display ads** — in `src/data/site.ts`, set `adsense.client` to your `ca-pub-…` id and `adsense.enabled: true`. Add per-slot ids to `<AdSlot slot="…" />`. Until then, slots render as labelled placeholders.
3. **Sponsored listings** — set `sponsored: true`; the offer sorts first and shows a **Sponsored** badge.

## Deploy

Static output → host free on Cloudflare Pages / Netlify / Vercel.
Build command `npm run build`, output dir `dist/`. Set your real domain in `astro.config.mjs` (`site`) and `public/robots.txt`.

## Auto-update

`.github/workflows/check-links.yml` runs `check-links` weekly (and on offer changes): fetches every URL, flags dead links and expired offers, uploads `link-report.json`. Extend it later to auto-open issues or PRs.

## Structure

```
src/
  content/offers/     # the curated database (Markdown)
  data/               # categories.ts, site.ts
  components/         # OfferCard, CategoryCard, Badge, AdSlot, Header, Footer
  layouts/Layout.astro
  pages/              # index, offers/, offers/[id], category/[category], methodology, 404
  lib/offers.ts       # sort / expiry helpers
scripts/              # check-links.mjs, validate-offers.mjs
```
