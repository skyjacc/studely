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

As of **2026-09-21** (full audit + execution plan): the public site is live, DB-driven
and honest; admin offers CRUD works; `/go` logs clicks; the weekly link checker runs
but has never written back (service-role secret missing — ADR-0030 amended to allow
exactly that one secret); `verifications` holds zero rows; no analytics; `studely.app`
has no MX. **AdSense rejected the site ~2026-08-02 for low-value content**: one offer
body (`github-student-pack`) was rewritten deep as the standard, thirteen remain ~700
character templates. Revenue is **$0** — no channel is switched on.

Order of work: **P0 Config Day** (MX, checker write-back, www, legacy root, crawlers
off `/go`, leaked-password toggle, vault sync) → **P1** write-path field registry with
`affiliate_url` as the acceptance test · first affiliate programme · verification
recorder · GA4 · thirteen deep bodies · AdSense re-submit only after all of that.
Canonical status lives in the vault's `CURRENT_STATE.md`.
