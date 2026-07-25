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
   * Default affiliate disclosure shown site-wide (FTC / ad-network friendly).
   */
  affiliateDisclosure:
    'Some links are partner or referral links. If you sign up through them we may earn a commission at no extra cost to you. This never affects whether an offer is listed.',
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
