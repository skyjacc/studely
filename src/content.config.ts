import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
import { categorySlugs } from './data/categories';

// The `offers` collection is the curated database. Each offer is one Markdown
// file in src/content/offers/. Frontmatter is validated against this schema at
// build time, so a malformed offer fails the build instead of shipping broken.
const offers = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/offers' }),
  schema: z.object({
    title: z.string(),
    /** Company / brand behind the offer, e.g. "GitHub". */
    provider: z.string(),
    category: z.enum(categorySlugs),
    /** One-sentence hook shown on cards and meta description. */
    summary: z.string(),
    /** Headline value, e.g. "$200k+ in tools" or "Pro plan free". */
    value: z.string(),
    offerType: z.enum(['free', 'discount', 'credit', 'trial']),
    /** Only for offerType: discount. */
    discountPercent: z.number().min(1).max(100).optional(),
    /** Editorial score 1-10 (value + ease + breadth). Shown as the green badge, drives default sort. */
    score: z.number().min(1).max(10).default(7),
    /** Destination link — put your affiliate / referral URL here when you have one. */
    url: z.string().url(),
    affiliate: z.boolean().default(false),
    sponsored: z.boolean().default(false),
    featured: z.boolean().default(false),
    /** How a student proves eligibility, e.g. "SheerID", ".edu email". */
    verification: z.string(),
    eligibility: z.string().default('Verified students worldwide'),
    /** ISO date string or the literal "ongoing". */
    expires: z.string().default('ongoing'),
    /** Set by the link-checker / editor — last time the offer was confirmed live. */
    lastChecked: z.coerce.date(),
    status: z.enum(['active', 'expiring', 'expired', 'unverified']).default('active'),
    tags: z.array(z.string()).default([]),
  }),
});

export const collections = { offers };
