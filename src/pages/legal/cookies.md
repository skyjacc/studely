---
layout: ../../presentation/layouts/LegalLayout.astro
title: "Cookie Notice"
description: "What cookies and similar technologies Studely uses, and how cookie consent works."
draft: false
---

This Cookie Notice explains how Studely ("Studely", "we", "us") uses cookies and similar
technologies (local storage, session storage) on **[https://studely.app](https://studely.app)**.
It should be read together with our [Privacy Policy](/legal/privacy).

Studely is operated by **an individual based in Romania** (full controller identity available on request), established in **Romania**.
Questions about this notice can be sent to **privacy@studely.app**.

- **Effective date:** 23 July 2026
- **Last updated:** 2026-07-29

---

## 1. What cookies and similar technologies are

A **cookie** is a small text file a website asks your browser to store. **Local storage**
and **session storage** are related browser mechanisms that let a site keep small amounts
of data on your device. In this notice, "cookies" is used loosely to cover all of these.

Cookies can be:

- **First-party** — set by Studely itself, or
- **Third-party** — set by another company whose code runs on our pages (for example, an
  advertising or analytics provider).

They can also be:

- **Session cookies** — deleted when you close your browser, or
- **Persistent cookies** — kept until they expire or you delete them.

---

## 2. What we use today

Today Studely is a mostly-static editorial directory. It runs **no analytics** of any kind.
The only cookies *we* set are **strictly necessary** cookies used for staff sign-in to the
private `/admin` area.

One third-party script is present on every page: the **Google AdSense tag** (see 2.2). No
advertisement is displayed anywhere on the site, but the tag is loaded, and Google may set
cookies or read device identifiers as a result — so this notice does not claim the site is
advertising-cookie-free.

There is **no public user account system** on the site today: sign-in exists only for
Studely staff. If you are simply browsing the public catalogue, the strictly-necessary
sign-in cookies below are set **only if you visit and use the admin login flow** — not by
ordinary browsing.

### 2.1 Strictly-necessary cookies (in use today)

These cookies are essential for the sign-in and session mechanism to function. Under
ePrivacy/PECR they are exempt from the prior-consent requirement because they are
**strictly necessary** to provide a service the user has explicitly requested (signing in).
They are **not** used for advertising or analytics.

- **Authentication is via magic link** through Supabase (GoTrue); there are no passwords.
- Session cookies carry the Supabase access and refresh tokens and are set `httpOnly`
  (not readable by JavaScript), `Secure`, and `sameSite=lax`.
- A short-lived PKCE code-verifier cookie is set during the sign-in exchange only.

### 2.2 Google AdSense tag (present on every page — no ads shown yet)

The AdSense script (`adsbygoogle.js`) is loaded site-wide. It is there because Google
requires the tag on the site in order to review and verify it. **No ad unit is configured,
so no advertisement is served or rendered anywhere on Studely today.**

Being loaded, the tag can still cause Google to set cookies or access information already
on your device. We therefore treat it as an advertising technology that is *live*, not
planned:

- In the **EEA, UK and Switzerland**, consent is collected by **Google's certified consent
  management platform**, which loads with the tag and is shown before consent-dependent
  purposes are activated. You can reopen it to change or withdraw your choice.
- Outside those regions, the tag operates under Google's own terms; see
  [How Google uses information from sites that use its services](https://policies.google.com/technologies/partner-sites).
- If you would rather block it entirely, a content blocker or a browser that blocks
  third-party scripts will prevent the tag from loading; the site works without it.

When ad units are switched on, this notice will be updated and the change described in
Section 3.

### 2.3 Local / session storage

Studely does not rely on browser local storage or session storage to store personal data.
The site's motion and design libraries (GSAP, Lenis, WebGL effects) run in the page and do
not set identifying cookies. If future features introduce local storage, this notice will
be updated.

---

## 3. What is not switched on yet

The following are **planned**. No advertisement is served and no analytics run today. When
any of them goes live, this notice will be updated and — for the EU/UK — consent must be in
place first (see Section 4). Note that the AdSense **tag** itself is already present and is
described in 2.2; this section covers what changes when ads actually start serving.

### 3.1 Advertising cookies — Google AdSense ad units (not serving yet)

The AdSense **tag** is already loaded on every page (see 2.2); what is not yet live is any
**ad unit**. Once units are configured and ads begin to serve, AdSense and Google's
advertising partners set cookies used to serve and measure ads, to limit how often you see
an ad, and — depending on configuration — to personalise ads. These are **not strictly
necessary** and, in the EU/UK, **require your prior consent** before any such cookie is set;
that consent is collected by Google's certified CMP described in 2.2.

### 3.2 Analytics cookies (planned / undecided)

Studely does **not** currently run any web analytics. If analytics are added later, we will
distinguish:

- **Cookieless / privacy-friendly analytics** (e.g. an aggregate, no-cookie product) — may
  not require consent depending on implementation, but this must be confirmed per
  jurisdiction; and
- **Cookie-based analytics** (e.g. Google Analytics) — **not** strictly necessary and, in
  the EU/UK, **requires prior consent**.

---

## 4. Consent — why a banner is required before non-essential cookies

Under the EU **ePrivacy Directive**, the **UK PECR**, and **GDPR/UK GDPR**, cookies that are
**not** strictly necessary may only be set **after** the user has given **prior, specific,
informed and freely-given consent**. Practically, for EU/UK visitors this means:

- **Strictly-necessary cookies** (Section 2.1) — no consent needed; set by default.
- **Advertising cookies** (AdSense) and **cookie-based analytics** — **blocked until the
  user opts in** via a consent banner. Rejecting must be as easy as accepting, and no
  non-essential cookie may fire before a choice is made.

Because the AdSense tag is already loaded (2.2), **Google's certified CMP is what collects
this consent today** for EEA/UK/Swiss traffic — it is not a future step. It must remain in
place, and consent must stay logged, renewable, and withdrawable at any time, before any ad
unit is switched on.

> **Students and minors**
> Studely's audience is students and may include minors (roughly ages 13–17). Consent and
> data-handling rules are stricter for children — for example, advertising personalisation
> to known minors is restricted, and the age of digital consent varies by EU member state
> (13–16). Our stated minimum age is **16**. See [Privacy Policy](/legal/privacy).

### US state law (CCPA/CPRA and similar)

For California and similar US states, using advertising cookies to share identifiers with ad
partners can count as a **"sale" or "sharing"** of personal information. If AdSense goes
live, Studely will likely need to offer a **"Do Not Sell or Share My Personal Information"**
control and honour **Global Privacy Control (GPC)** browser signals. These are opt-**out**
rights (different from the EU opt-**in** model).

---

## 5. Third parties in the page

Some cookies are or will be set by third parties whose services we use. Their processing is
governed by **their** policies, not only ours:

| Party | Role | Cookies today? | Notes |
|---|---|---|---|
| **Supabase** | Auth / database (session tokens) | Yes — strictly necessary | Sets the sign-in session cookies described in 2.1 |
| **Vercel** | Hosting / CDN | Possibly (operational) | May set operational cookies at the platform edge |
| **Cloudflare** | DNS | Not expected on-page | DNS only; no first-party page cookie expected |
| **Google (AdSense)** | Advertising (**planned**) | **No — not live** | Will set advertising cookies once enabled; consent-gated in EU/UK |
| **Resend** | Transactional email delivery | No (not on-page) | Delivers the magic-link email; sets no cookies in your browser |
| **Affiliate vendors** | Outbound offer links | On the vendor's own site | Clicking an offer takes you to a third-party site that may set its own cookies |

> **Affiliate outbound links**
> Studely's catalogue links out to third-party vendors. None of those links is an affiliate
> link today, though some are expected to become one. Cookies set **after** you click
> through are governed by the destination site's own cookie and privacy notices — we have no
> control over them. See the [Affiliate & Advertising Disclosure](/legal/disclosure).

---

## 6. Cookie table

The table lists what is known today plus the planned additions, clearly marked. Durations
for third-party advertising cookies are set by the provider and can change; the values below
are typical and follow Google's current documentation.

| Cookie / item | Set by | Category | Purpose | Duration | Status |
|---|---|---|---|---|---|
| `sb-<project>-auth-token` (and split chunks) | Supabase (first-party) | Strictly necessary | Holds the signed-in session (access + refresh token) for `/admin` | Up to the refresh-token lifetime (long-lived; ~400 days unless you sign out) | **Live** (staff sign-in only) |
| PKCE code-verifier cookie | Supabase (first-party) | Strictly necessary | Completes the magic-link sign-in exchange securely | Short-lived (cleared after the exchange) | **Live** (during sign-in only) |
| Vercel operational cookie(s) | Vercel | Strictly necessary | Platform routing / security, if set | Session / provider-defined | **To confirm** |
| Google `__gads`, `__gpi`, `IDE`, `test_cookie`, etc. | Google AdSense (third-party) | Advertising | Serve/measure/frequency-cap and (if configured) personalise ads | Provider-defined (commonly up to ~13 months) | **Planned — not live** |
| Analytics cookie(s) (e.g. `_ga`, `_ga_*`) | Analytics provider (if adopted) | Analytics | Measure site usage | Provider-defined (commonly up to ~2 years) | **Planned / undecided** |

---

## 7. How to control cookies

You can control or delete cookies in several ways:

- **Consent banner (when live):** once the CMP is deployed, use it to accept or reject
  advertising and analytics cookies, and to change your choice at any time. For strictly-
  necessary cookies there is no opt-out, because the sign-in service cannot work without
  them.
- **Browser settings:** all major browsers let you block or delete cookies and clear local
  storage. Blocking strictly-necessary cookies will break staff sign-in but will not stop
  you browsing the public catalogue.
- **Global Privacy Control (GPC):** where applicable (e.g. California), we intend to honour
  the GPC browser signal as an opt-out of sale/sharing once advertising is live.
- **Google Ads settings:** if/when AdSense is live, you can manage ad personalisation via
  Google's own ad settings.

Browser help pages:
[Chrome](https://support.google.com/chrome/answer/95647) ·
[Firefox](https://support.mozilla.org/kb/cookies-information-websites-store-on-your-computer) ·
[Safari](https://support.apple.com/guide/safari/manage-cookies-sfri11471/mac) ·
[Edge](https://support.microsoft.com/help/4027947).

---

## 8. Changes to this notice

We will update this notice when our use of cookies changes — in particular **before** AdSense
or any analytics goes live. The "Last updated" date at the top will change accordingly. For
EU/UK visitors, material changes affecting non-essential cookies will be reflected in the
consent banner.

---

## 9. Contact

Questions about cookies or this notice: **privacy@studely.app** (privacy contact:
**privacy@studely.app**). Operator: **an individual based in Romania (full controller identity available on request via privacy@studely.app)**, **Romania**.

---

## Related

Legal
