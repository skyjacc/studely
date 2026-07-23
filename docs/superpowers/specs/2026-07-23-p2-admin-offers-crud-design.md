# P2 — Admin offers CRUD

**Date:** 2026-07-23
**Status:** approved (design), pending spec review
**Scope:** a working operator UI to create, edit, publish/unpublish, and delete offers — plus their scoring attributes — writing to Supabase under the signed-in staff session. Resolves the first of the three admin `404`s (`/admin/offers`). Visual direction: the approved dark-editorial admin concept.

---

## 1. Goal & non-goals

**Goal.** A signed-in admin can, without touching SQL: see every offer (draft / published / archived), create a new one, edit its fields, edit its scoring attributes (which drive the derived score), and publish or unpublish it. Publishing a change fires a deploy so it reaches the live static site.

**Non-goals (explicit):**
- No submissions queue, no comments moderation — separate later specs. (Those two nav links keep 404-ing for now.)
- No ads / earnings panel, no AdSense API — P3 (needs Google OAuth).
- No persisted drag-to-reorder — deferred to P2.1 (needs a `sort_order` column + a public-sort change). The list uses the card visual but orders by the existing logic; in-list quick actions (publish/unpublish/edit) cover the day-to-day "convenience" this iteration.
- No slug rename after creation — renaming breaks the live `/offers/<slug>` URL and its SEO; a deliberate rename-with-redirect is a later feature. Slug is set at creation, read-only thereafter.
- No public-site changes. The site already reads the DB (P1); this only writes to it.

---

## 2. Approach (chosen: Astro SSR page POST handlers)

Each admin page is server-rendered (`prerender = false`, already enforced by CI). Forms POST to the same route; the page's frontmatter handles `Astro.request.method === 'POST'`, validates, mutates, and redirects (Post/Redirect/Get). Writes go through `createSupabaseServer(request, cookies)` — the signed-in admin's session — so every mutation runs under RLS policy `offers_staff` / `attrs_staff` (`is_staff()`). This matches the existing auth-handler pattern and adds no API layer or client framework.

**Rejected alternatives:**
- *Astro Actions* — a typed server-action pattern the project doesn't use yet; more setup for no gain at this size.
- *`/api/` endpoints + client `fetch`* — introduces the API layer the project has deliberately avoided, plus client JS, for a form the server can handle directly.

---

## 3. Routes & files

**New pages** (all `export const prerender = false`, rendered in `AdminLayout`):
| Route | File | Responsibility |
|---|---|---|
| `/admin/offers` | `src/pages/admin/offers/index.astro` | Card-gallery list of ALL offers (draft/published/archived) via the staff client. Each card links to its editor and carries an inline publish/unpublish action (POST to this route with `id` + `_action`). "New offer" → `/admin/offers/new`. |
| `/admin/offers/new` | `src/pages/admin/offers/new.astro` | Create form. `new.astro` shadows the dynamic route, so it wins over `[slug]`. POST → validate → insert (visibility `draft`) → redirect to the editor. |
| `/admin/offers/[slug]` | `src/pages/admin/offers/[slug].astro` | Edit form + attribute editor + publish/unpublish/delete actions. GET prefills from the row; POST branches on `_action` (`save` / `publish` / `unpublish` / `delete`). |

**New libraries:**
| File | Responsibility |
|---|---|
| `src/lib/offer-input.ts` | **Pure**, no Supabase import: `slugify()`, `validateOfferInput()`, `parseTags()`, `selectedAttributes()` (chosen keys → `{key,label,points}[]` from the vocabulary), and the `OfferInput` type. Unit-tested. |
| `src/lib/admin-offers.ts` | Takes a staff Supabase client. IO mutations: `listAllOffers`, `getOfferBySlug`, `createOffer`, `updateOffer`, `setVisibility`, `deleteOffer`, `replaceAttributes`. Uses `offer-input` for validation/slug. |
| `src/lib/deploy-hook.ts` | `triggerDeploy()` — POST to `process.env.VERCEL_DEPLOY_HOOK_URL`. No-op (logs) when the env var is unset; never throws into the request path. |

**Reused as-is:** `src/layouts/AdminLayout.astro` (the nav already lists these destinations), `src/lib/supabase.ts` (`createSupabaseServer`), `src/data/categories.ts` (category select options), `src/data/attributes.ts` (the scoring vocabulary).

---

## 4. Data model touchpoints

`offers` and `offer_attributes` (schema in `supabase/migrations/0001_init.sql`). No migration needed for P2.

**Editable offer fields** (form): `title, provider, category, summary, value, body, offer_type, discount_percent, url, affiliate, sponsored, featured, verification, eligibility, tags, status, expires_at`. Category is a `<select>` of `categorySlugs`; `offer_type` and `status` are enum `<select>`s; `tags` is a comma-separated input; `expires_at` is a date input plus an "ongoing" checkbox that maps to `NULL`.

**Never written by the editor:** `score` (derived), `id`, `slug` (after create), `created_at`, `updated_at`, `created_by`, `last_checked`.
- `created_by` is set to `auth.uid()` on create.
- `last_checked` defaults to `now()` on create and is otherwise owned by the link checker.
- `visibility` is changed only by the explicit publish/unpublish/archive actions, not by the field-save form.

**Score & attributes.** `score` is recomputed by the DB trigger `offer_attributes_rescore` → `recompute_offer_score()` = `clamp(5 + sum(points), 1, 10)`, which fires AFTER insert/update/delete on `offer_attributes` only. Consequences the editor relies on:
- A brand-new offer with no attributes keeps `score = 7` (column default) until an attribute is touched — expected.
- The attribute editor presents the vocabulary from `src/data/attributes.ts` as toggleable chips; each carries its canonical `label` + `points`. Saving does `replaceAttributes(offerId, selected)` = delete the offer's rows, insert the selected ones; the trigger recomputes `score`. After the write, the page re-reads the offer to show the new score (read-only).
- v1 is vocabulary-only — no free-form custom attributes (keeps scoring calibrated and every point attributable).

---

## 5. Slug rules

On **create**: `slug` is pre-filled by `slugify(title)` (lowercase, strip diacritics, non-`[a-z0-9]`→`-`, collapse, trim) and is editable. It must match `^[a-z0-9]+(?:-[a-z0-9]+)*$` and be unique. A uniqueness conflict re-renders the form with a named error ("that slug is taken — edit it"); slugs are never silently suffixed.

On **edit**: `slug` is displayed read-only. Renaming is out of scope (breaks the live URL + SEO).

---

## 6. Deploy freshness

The public site is static; content reaches it only on a redeploy. After any mutation that changes what a published build would output, the handler calls `triggerDeploy()`.

**Fires when** the offer is published before OR after the mutation:
- publish (draft → published), unpublish/archive (published → draft/archived), delete of a published offer, and any field/attribute save on an already-published offer.

**Does not fire** for create (defaults to draft), or edits/deletes of a draft/archived offer.

The owner creates a Vercel Deploy Hook once (Project → Settings → Git → Deploy Hooks) and sets `VERCEL_DEPLOY_HOOK_URL` in Vercel + local `.env` + `.env.example`. If unset, `triggerDeploy()` logs and returns — saves still succeed; the change simply waits for the next manual deploy. A hook failure is caught and logged, never surfaced as a save error.

---

## 7. Form handling & validation

Standard Astro SSR form flow per page:
1. **GET** → render the form (empty for `new`, prefilled for `[slug]`).
2. **POST** → read `Astro.request.formData()`, branch on the hidden `_action` field, run `validateOfferInput()`.
3. On **valid** → mutate → `triggerDeploy()` if applicable → `Astro.redirect()` (PRG) to the editor (with a success flag) or back to the list (after delete).
4. On **invalid** → re-render the same form with the field errors and the values the user entered (no data loss), HTTP 200.

`validateOfferInput()` mirrors the DB constraints so bad input is a friendly form error, not a 500:
- required & non-empty: `title, provider, category, summary, value, url, verification`;
- `category ∈ categorySlugs`; `offer_type ∈ {free,discount,credit,trial}`; `status ∈ {active,expiring,expired,unverified}`;
- `url` matches `^https?://`;
- `discount_percent`: integer 1–100, **required iff** `offer_type === 'discount'`, **must be absent** otherwise (mirrors `discount_pct_only_for_discounts`);
- `slug` (create only): matches the slug regex and is unique;
- `eligibility` defaults to `'Verified students worldwide'` when blank; `tags` parsed from the comma list.

---

## 8. Error handling & security

- All three routes set `prerender = false`; the middleware staff-gate runs and CI fails the build if any admin route omits it.
- Every read and write uses `createSupabaseServer` (the admin's session). RLS is the real guard: a non-staff session is denied by `offers_staff`/`attrs_staff`. The UI never trusts the client for authorization.
- A denied or failed mutation re-renders the form with an error banner; it never silently "succeeds".
- The editor cannot set `score`, `id`, `created_by`, or (post-create) `slug` — they're not form fields and the mutation layer ignores any that arrive.
- `triggerDeploy()` failures are logged, not raised — a broken hook must not block content edits.

---

## 9. Styling

Port the approved dark-editorial concept into the real pages: the card-gallery list (provider tile, value, score badge, status pill) and a clean two-column editor form. Reuse the existing design tokens in `src/styles/global.css`; add page-scoped `<style>` per route. Motion is now welcome here (the earlier "admin has no motion" rule is superseded by the owner's request): tasteful CSS transitions — card hover-lift, count-up is not needed on CRUD screens, staggered list reveal — all gated behind `prefers-reduced-motion`. `AdminLayout` keeps its no-heavy-runtime base (no GSAP/Lenis/WebGL); the motion here is plain CSS.

---

## 10. Testing

- **vitest (pure, `src/lib/offer-input.test.ts`):** `slugify()` (diacritics, spaces, punctuation, collapsing); `validateOfferInput()` (each required-field error, the discount/offer_type coupling both ways, bad url, bad slug, blank-eligibility default); `parseTags()`; `selectedAttributes()` (keys → rows from the vocabulary, unknown key ignored).
- **Integration (manual / preview):** sign in, create an offer, add attributes and confirm the score changes, publish and confirm a deploy is triggered, edit and unpublish. Verified with the preview tools.
- **CI:** the existing `prerender = false` guard already covers the three new admin routes; `npm run check` and `npm run build` must stay green.

---

## 11. Out of scope → later

- Submissions queue, comments moderation (own specs).
- Ads / earnings + AdSense reporting API (P3).
- Persisted drag-to-reorder + a `sort_order` column and public-sort change (P2.1).
- Slug rename with redirect.
- Free-form (non-vocabulary) scoring attributes.
