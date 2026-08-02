// Global site configuration. Change these values to rebrand the whole site.

export const site = {
  name: 'Studely',
  tagline: 'Claim what’s free for students.',
  description:
    'Free tools, cloud credits, courses and student discounts — each scored against clear criteria, with the reasoning shown.',
  /** Derived from astro.config `site` so it can't drift; literal is only a dev fallback.
   *  Production resolves to studely.app via PUBLIC_SITE_URL / the Vercel host. */
  url: import.meta.env.SITE ?? 'http://localhost:4321',
  locale: 'en',
  author: 'Studely',
  /**
   * Google AdSense. `client` set + `enabled` loads the verification/auto-ads
   * script in <head>, which is what "connect your site" in AdSense needs.
   * Manual ad units only render once their `slots` id is filled in (from
   * AdSense → Ads → "By ad unit"); an empty slot renders nothing on production,
   * so there are no blank/placeholder boxes before the units exist.
   * A cookie-consent message is required for EEA/UK — enable Google's built-in
   * GDPR message in AdSense (Privacy & messaging).
   */
  adsense: {
    client: 'ca-pub-1024097074226135',
    enabled: true,
    slots: { inFeed: '', inArticle: '', leaderboard: '' },
  },
  /**
   * Site-wide monetisation disclosure. Must describe what is true TODAY, not the
   * business model we intend. It previously said "some links are partner or
   * referral links" while no offer carried one and no ad had ever served — a
   * claim about ourselves that the data did not back, on every page.
   *
   * When the first affiliate link or ad unit goes live, switch this to the
   * present tense the same day, and set `affiliate: true` on the offers it
   * applies to so the per-offer label appears alongside it.
   */
  affiliateDisclosure:
    'Studely earns nothing today: no offer here is an affiliate link and no advertising is running. We intend to add both, and will say so plainly here and on the offer itself when we do. Payment will never buy a better score.',
  /** Contact address shown in the footer. Swap for your real inbox. */
  email: 'hello@studely.app',
  /** Short status line shown in the footer bottom bar. Must stay a fact we can
   *  demonstrate — never a cadence promise (nothing adds offers on a schedule). */
  availability: 'Independent student directory',
  /** Fill any of these to show a social link in the footer; empty ones are hidden. */
  social: {
    twitter: '',
    github: '',
    reddit: '',
  },
} as const;

export type SiteConfig = typeof site;
