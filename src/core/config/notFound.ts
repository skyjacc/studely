// Copy and destinations for the 404 page. Centralised so the wording — and the
// three ways out — live in one place instead of being buried in 404.astro.

export const notFound = {
  meta: {
    title: 'Page not found',
    description:
      'That page is not in the Studely directory. Browse the full list of verified student offers instead.',
  },
  /** Shown as the mono system eyebrow and echoed in the terminal readout. */
  status: { code: 404, label: 'Not Found' },
  /** HTTP method echoed in the terminal readout. */
  method: 'GET',
  /** The giant hero number. */
  code: '404',
  heading: 'Dead link.',
  lead:
    'We re-check every offer link weekly. This one is not an offer: it moved, expired, or was never here.',
  /** Ways out — real destinations only, in priority order. */
  exits: [
    { label: 'All offers', href: '/offers' },
    { label: 'All categories', href: '/categories' },
    { label: 'Back home', href: '/' },
  ],
} as const;

export type NotFoundConfig = typeof notFound;
