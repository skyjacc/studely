# Studely — Roadmap

**Updated:** 2026-07-23
**Year-1 goal:** make Studely **profitable**, not big. 100k users is a consequence, not a target.
**Moat:** verification / data quality / trust. A list is copyable; a trusted, always-current, justified database is not.
**Positioning:** *the verified student-benefits database — ranked by real value* (not "a freebies catalog").

---

## The decision filter (read this before adding anything)

> **Every feature must increase at least one of:**
> **Revenue · Trust · SEO · Conversion · (or) reduce Maintenance.**
>
> If a new idea doesn't clearly hit one of these — it goes to the backlog. No exceptions.

Worked examples:
- Trust Score on cards → ✅ Trust
- Affiliate analytics → ✅ Revenue
- Link checker → ✅ reduce Maintenance
- Collections (Best for Devs/Design/AI…) → ✅ SEO
- Browser extension / mobile app / AI chat / "nicer animations" → ❌ none → **not now**

---

## Vision ≠ Roadmap

**Vision (direction, NOT a plan):** verification platform, public API, AI editor-assistant, crawler, analytics platform, mobile, a multi-domain/multi-service data platform. This is *where it could head in 3–5 years* — it is not a to-do list. Build toward it only when revenue + audience make each piece pay for itself.

**Roadmap (what we actually build now):** below.

---

## NOW — the profitability slice

The order matters: you can't manage revenue you don't earn, and you can't earn from channels that are off. Reliability because it's already production. Trust because it's cheap and it *is* the brand.

### 1. Money — until this works, nothing else matters
- **Affiliate** via a tracking redirect: `Get this offer` → `/go/<slug>` → log the click → 302 to the affiliate URL. Affiliate URL lives in one place (swap without touching content). *(Increase Revenue + Conversion.)*
- **Ads on**: create AdSense ad units → put slot IDs in `site.ts`; add the `VERCEL_DEPLOY_HOOK_URL` so publishing rebuilds the live site. *(Owner dashboard actions + small code.)*
- **Sponsored** placement + clear labelling: `🟢 Verified · ⭐ Sponsored · 🟣 Partner` so the user always knows why an offer ranks. *(Revenue + Trust.)*
- **Target revenue mix (2–3 yr):** Affiliate 50–60% · Ads 20–30% · Sponsored 15–25% · Premium 0–10%. Ads are volatile (CPM/season/adblock); affiliate scales with recommendation quality — so **affiliate is the priority channel**, not ads.

### 2. Measurement — you can't steer what you don't measure
- **Analytics** (Plausible or Vercel Analytics — not GA). Page views per offer page. *(informs SEO + Revenue.)*
- **Click tracking** comes free from the `/go` redirect above (CTR per offer).
- **Offer ROI** foundation: views · clicks · revenue per offer → *value per offer*, not offer count. Chase "10 more GitHub-tier offers", not "+100 offers".
- Realism: affiliate revenue comes from each network's dashboard (manual entry / API later); ad RPM from AdSense channels. The revenue view is multi-source and partly manual at first — that's fine.

### 3. Reliability — it's production now
- Sentry (errors + performance) · tests in CI (`npm test`) · ESLint + Prettier · security headers + CSP.

### 4. Trust — cheap, and it's the moat made visible
- Surface what the DB already holds: **Verified** badge, **Last checked**, **Trust Score + "why?"** (the `offer_attributes` breakdown: `+ full tier / + no card / − verification required`). Data exists — this is a display change, days not weeks. *(Increase Trust.)*

### 5. Editor Experience — the admin is the owner's daily tool
Not just CRUD — answer **"what should I do today?"**: offers needing review, broken links, missing affiliate URL, missing logo/screenshot, missing verification, missing score. Saves hours → grows the catalog faster. *(reduce Maintenance.)*

---

## NEXT — after money + measurement produce data

- **Collections** as dedicated pages: "Best for Developers / Designers / AI tools / Cloud credits / Startups". *(SEO + retention.)*
- **Editor Dashboard → Revenue Analytics**: per-offer views · CTR · affiliate · ad RPM · sponsored · total; **Page RPM** (revenue / 1000 views). Built once the numbers exist — not before (empty tables help no one).
- **Maintenance-cost score** per offer (value ÷ upkeep): GitHub 10/10, a single volatile local-uni offer 2/10 → deprioritise high-effort / $0 offers.
- **Email digest** (new / changed offers) · **expiry alerts** with alternatives. *(Conversion + retention.)*

---

## LATER / VISION — only when revenue + audience justify

Public API (Hono, when there's a real external consumer) · mobile · browser extension · crawler + AI-draft pipeline (crawl → extract → AI diff → **draft** → human review → publish; never auto-publish) · full verification system (status enum + confidence + reviewer + change-history) · knowledge-graph relationships · Meilisearch/Typesense (Pagefind is fine for a long time) · premium tier · splitting into independent deployed services.

---

## Explicit non-goals right now (negative ROI today)

React · Tailwind · shadcn/ui (would re-platform a working, on-brand editorial UI for $0 gain) · Drizzle ORM (Supabase works — don't fix a non-problem) · Meilisearch (14 offers 😄) · Hono/public API (no external consumer yet) · mobile · browser extension · AI chat · queues / crawler service / multi-service split.

---

## KPIs (watch weekly)

Revenue **split** (affiliate / ads / sponsored), **Offer ROI** table, **Page RPM**, organic traffic + CTR, average Trust Score, average verification age (days since last check), active vs verified offers. **Not** raw user count.
