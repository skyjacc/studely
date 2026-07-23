# P1 — DB-swap: public pages read from Supabase

**Date:** 2026-07-23
**Status:** approved (design), pending spec review
**Scope:** the public site stops reading Markdown and reads the `offers` table in Supabase instead. Read-only. No visual change, no write path, no admin work.

---

## 1. Goal & non-goals

**Goal.** Every public page that today calls `getCollection('offers')` reads its data from the Supabase `offers` table at build time instead. The rendered site is byte-for-byte equivalent to today's Markdown-driven site (the DB was seeded from the same data and the bodies are md5-verified against the Markdown).

**Freshness model:** static. Pages stay prerendered; the DB is read at build. Content refreshes on redeploy. The publish→redeploy hook is **P2**, not here.

**Non-goals (explicit):**
- No admin CRUD, no write path, no forms — that is P2.
- No visual redesign — that is a separate later workstream.
- No deploy-hook / ISR / SSR.
- Categories stay static (`src/data/categories.ts`). The DB `categories` table is not wired in P1; only `offers` swaps.
- `submissions`, `comments`, `verifications`, `link_checks` untouched.

---

## 2. Approach (chosen: adapter module)

A new module `src/lib/offers-source.ts` reads the DB and returns objects **shaped like the current collection entry** — `{ id, slug, data, body, attributes }` — so consumers change one line (`getCollection('offers')` → `await getAllOffers()`) and every downstream `o.data.*` / `o.body` keeps working.

**Rejected alternatives:**
- *Raw DB row as the type (snake_case).* Rewrites every `.data.` access across 6 files + components. High churn, high risk.
- *Custom Astro content-loader from Supabase.* Call-sites stay literally unchanged, but it couples to the experimental loader API and hides the mapping. Harder to debug for no real gain here.

---

## 3. Data-access module — `src/lib/offers-source.ts`

```ts
export interface OfferAttr { key: string; label: string; points: number }

export interface OfferData {
  title: string;
  provider: string;
  category: string;
  summary: string;
  value: string;
  offerType: 'free' | 'discount' | 'credit' | 'trial';
  discountPercent?: number;
  score: number;                 // derived in DB by trigger; read-only here
  url: string;
  affiliate: boolean;
  sponsored: boolean;
  featured: boolean;
  verification: string;
  eligibility: string;
  expires: string;               // ISO date string, or the literal "ongoing"
  lastChecked: Date;
  status: 'active' | 'expiring' | 'expired' | 'unverified';
  tags: string[];
}

export interface OfferView {
  id: string;                    // = slug, so /offers/[id] routing is unchanged
  slug: string;
  data: OfferData;
  body: string;                  // raw Markdown from offers.body
  attributes: OfferAttr[];
}

export async function getAllOffers(): Promise<OfferView[]>;
export async function getOffer(slug: string): Promise<OfferView | null>;
```

**Client.** `createSupabaseAdmin()` (service-role, already documented as the build-time reader). Build/server context only — never imported by client code.

**Queries.** One `offers` select filtered `visibility = 'published'`; one `offer_attributes` select for those offer ids; joined in memory. Two round-trips total, at build.

---

## 4. Field mapping (DB row → `OfferData`)

| DB column | `OfferData` field | rule |
|---|---|---|
| `slug` | `id` (and `slug`) | routes `offers/[id]` match by slug — preserved |
| `title, provider, category, summary, value, url, affiliate, sponsored, featured, verification, eligibility, tags, score` | same names | 1:1 |
| `offer_type` | `offerType` | enum identical (`free/discount/credit/trial`) |
| `discount_percent` | `discountPercent` | `null` → omitted |
| `last_checked` (timestamptz) | `lastChecked` | → `Date` |
| `expires_at` (date, nullable) | `expires` | `null` → `"ongoing"`, else ISO `YYYY-MM-DD` string |
| `status` | `status` | enum identical (`active/expiring/expired/unverified`) |
| `body` | `body` | already populated, md5-verified against Markdown |
| `visibility` | — | filter only: keep `published`, drop `draft`/`archived` |

The helpers in `src/lib/offers.ts` (`daysUntil`, `isExpired`, `isExpiringSoon`, `verifyGroup`, `scoreTier`, `offerTypeLabel`, `sortOffers`, `formatDate`) operate on `o.data.*` with these exact field names and types, so they keep working unchanged. Only the `Offer` type alias changes: `CollectionEntry<'offers'>` → `OfferView`.

---

## 5. Attributes

`src/data/attributes.ts::SEED_ATTRIBUTES` (a hardcoded map keyed by Markdown id) is replaced by the `offer_attributes` rows attached to each `OfferView`.

- **"No card required" facet** (offers list): `!offer.attributes.some(a => a.key === 'card_required')`.
- **Score breakdown** (offer detail): rendered straight from `offer.attributes` — each row carries its own `label` and `points`, so the local `ATTRIBUTE_DEFS` are no longer needed for display.

`src/data/attributes.ts` stays in the tree (the `AttributeKey`/`AttributeDef` types may still be referenced by P2's editor), but `SEED_ATTRIBUTES` stops being read by public pages.

**Risk:** if `offer_attributes` in the DB is empty or keyed differently than the Markdown assumed, the facet/breakdown drift. Mitigated by the verification step (§8): the seed note claims 42 rows; the diff catches any mismatch.

---

## 6. Body rendering

The detail page today does `const { Content } = await render(offer); <Content />` — a content-collection API bound to the entry. Bypassing the collection means `render()` is unavailable, so the raw Markdown from `offers.body` must be rendered another way.

**Decision:** render `body` → HTML at build with `marked` (GFM enabled), inject via `set:html` inside the existing `.prose` container. Add `marked` as a dependency.

- Astro's Markdown defaults (GFM on, Shiki for code) — the bodies are simple (headings, bold, lists, links; no code blocks), so `marked` with GFM reproduces the output closely. The verification diff (§8) is the guard.
- Bodies are trusted operator content (identical to the Markdown already shipped), so sanitisation is defence-in-depth only. **Skip a sanitiser in P1**; revisit when user-generated content (submissions/comments) can reach a rendered surface. Recorded as a follow-up.

---

## 7. Files changed

**New:** `src/lib/offers-source.ts`.

**Edited (swap `getCollection('offers')` → `getAllOffers()` / `getOffer()`):**
- `src/pages/index.astro`
- `src/pages/offers/index.astro`
- `src/pages/offers/[id].astro` (also: `render()`+`<Content/>` → `marked(body)`+`set:html`)
- `src/pages/categories.astro`
- `src/pages/category/[category].astro`
- `src/components/Footer.astro`
- `src/lib/offers.ts` (`Offer` type alias → `OfferView`)

**Left dead, removed only in the final verified step:** `src/content/offers/*.md`, `src/content.config.ts`. Kept until the DB render is verified equivalent, then deleted in one commit.

**Dependency:** `+ marked`.

---

## 8. Verification

The DB was seeded from the same source and bodies are md5-verified, so the swap must be provably equivalent.

1. **Build both.** Capture the current Markdown-driven `dist/` (baseline), then build the DB-driven `dist/`.
2. **Set diff.** Same 14 slugs present; same categories; same per-offer `score`, `offerType`, `status`, `expires`, `lastChecked`, `tags`.
3. **HTML diff.** Compare `dist/offers/*.html` and `dist/offers/index.html` between baseline and DB build; investigate every difference. Body region: expect equivalence modulo `marked` vs Astro-remark whitespace — inspect, don't assume.
4. **Facets.** "No card" count and each score breakdown match the baseline.
5. **Preview.** `preview_*`: load home, offers list, one detail page; confirm cards, filters, badges, breakdown render.
6. **CI guard.** Fail the build if `getAllOffers()` returns 0 published offers (an empty directory is never correct here).

Only after 1–6 pass: delete the Markdown files + `content.config.ts`.

---

## 9. Error handling

- **DB unreachable / env missing at build:** `createSupabaseAdmin()` already throws — the build fails loudly. No silent fallback to Markdown (a silent fallback would hide a broken swap).
- **0 published rows:** build does not crash, but the CI guard (§8.6) fails it.
- **A row violates the enum/shape:** mapping throws with the offending slug named.

---

## 10. Rollout order (for the plan)

1. Add `marked`; write `src/lib/offers-source.ts` + `OfferView`/`OfferData` types.
2. Point `src/lib/offers.ts` `Offer` alias at `OfferView`.
3. Swap consumers one file at a time, building after each.
4. Swap the detail-page body render to `marked` + `set:html`.
5. Run the full verification (§8).
6. Delete the Markdown collection + config; final build + preview.

---

## 11. Out of scope → later

- Publish→redeploy deploy-hook (P2).
- Admin CRUD (P2).
- Body sanitiser (when user content can reach a rendered surface).
- DB-backed categories.
- Visual redesign (separate workstream).
