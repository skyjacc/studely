# Studely — Foundation

> **The one rule.** Any change to Studely must do at least one of:
> **increase revenue · increase trust · improve SEO · reduce maintenance cost · speed up the editor.**
> If it does none of these, it is not a priority. It goes to the backlog.

This is the project's constitution — what we build, why, and how we decide. Read it top to bottom before the README. Technical docs (ARCHITECTURE, DATABASE, API…) describe *how the code works today*; this describes *what stays true regardless*.

---

## 1. What Studely is

Studely is **not** a discount catalog or a list of student offers.

Studely is **the most trusted database of verified student benefits** — it helps students quickly find genuinely valuable programs, and helps companies reach a quality audience.

We do not try to collect the most offers. We collect the **most useful and most current** ones.

> **This section is the destination, not a description of today.** It must never
> be quoted into user-facing copy. On the site we may claim only what the data
> proves right now: the Studely score and its visible breakdown. "Verified",
> "re-checked weekly", "always current" and similar stay out of the product until
> a real record backs them (a passing row in `verifications`, a real
> `link_checks` run). Overclaiming costs more trust than an unfinished feature.

---

## 2. The core principle

**Better, not bigger. Quality over quantity.**

If a competitor has 500 offers and we have 150 that are always current and better described — that can be enough. One GitHub-tier offer is worth more than fifty forgettable ones.

---

## 3. Our moat

Not technology. Not design. Not SEO.

```
Verification → Trust → Quality data
```

Our competitive advantage is **not the number of offers — it's trust in every offer.** A list can be copied in a weekend; a trusted, always-current, justified database cannot.

---

## 4. How we decide (the filter)

Every idea must increase at least one of:

- **Revenue**
- **Trust**
- **SEO**
- **Editor experience** (speed of maintaining the catalog)
- or **reduce maintenance cost**

Examples: Trust Score → Trust ✅ · Affiliate analytics → Revenue ✅ · Link checker → Maintenance ✅ · Collections → SEO ✅ · Browser extension / mobile / AI chat / nicer animations → none ❌ → **not now**.

---

## 5. How the product evolves (foundations, in order)

Each stage produces measurable value and stands on the previous one. This is a philosophy of sequencing, not a dated plan.

**1. Revenue Foundation** — first, the ability to earn and to see the path to money.
`/go/<slug>` redirect · affiliate URLs (abstracted, swappable) · one analytics event `offer_clicked`.

**2. Trust Foundation** — then, make the moat visible and lift conversion.
Verified badge · Last checked · Trust Score + "why this score" · Sponsored / Partner labels.

**3. Editor Foundation** — then, the editor's workbench, not just CRUD.
"Needs review" · broken links · missing affiliate / logo / screenshot / verification / score · catalog-health tasks.

**4. Automation Foundation** — only after the above is validated.
Link checker · AI editor-assistant (diff detection) · verification assistant · crawler → draft → human review.

---

## 6. What we do NOT do

- Don't rewrite working code for a prettier architecture.
- Don't build infrastructure that doesn't create value.
- Don't build a mobile app before the site pays for itself.
- Don't add AI unless it reduces manual work.
- Don't add a feature that can't be tied to revenue, trust, or quality.

---

## 7. Architecture principles

```
Simple first.
Layers over microservices.
Static where possible, dynamic where necessary.
Measure before optimizing.
Data before dashboards.
Automation after validation.
```

Current shape that honors these: static prerendered public site (CDN) + serverless admin/actions + one Postgres (Supabase), organized in `core / domain / services / presentation` layers with path aliases. That's the "doesn't block growth" version — not "built for growth".

---

## 8. North Star (direction, not a plan)

```
Verified Student Benefits Platform
  → Public API
  → Mobile
  → AI editor-assistant
  → Browser extension
  → Partner widgets
  → Crawler / verification pipeline
```

**This is the direction after a sustainable revenue model exists — not a to-do list.** Each piece is built only when revenue + audience make it pay for itself.

---

## Where we are now

As of **2026-07-24**, public site is live and DB-driven; `/go/<slug>` click
tracking and admin offers CRUD exist; CI runs tests, type-check, and build; and
operations hardening is being rolled out. Migration `0007` is applied in
Supabase, adding atomic offer+attribute saves and transactional link-check
write-back. Production still needs Vercel environment confirmation, deploy-hook
configuration, a deployment carrying the legacy-host redirect, and GitHub's
service-role secret before scheduled checks can write back.

Revenue remains **$0**: no affiliate links are configured, and AdSense is under
Google review with ad-unit slots intentionally empty. Next work should close
those operator rollout gaps, then measure verification freshness and outbound
clicks before adding more product surface.
