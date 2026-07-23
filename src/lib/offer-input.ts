// Pure input handling for the admin offer editor: slugging, validation, tag and
// attribute parsing. No Astro and no Supabase imports, so it is unit-testable in
// isolation. The IO layer (admin-offers.ts) calls these before it writes.

import { categorySlugs } from '../data/categories';
import { ATTRIBUTES, attributeByKey, type AttributeKey } from '../data/attributes';
import type { OfferType, OfferStatus } from './offer-mapping';

const OFFER_TYPES: OfferType[] = ['free', 'discount', 'credit', 'trial'];
const STATUSES: OfferStatus[] = ['active', 'expiring', 'expired', 'unverified'];
const CATEGORIES = new Set<string>(categorySlugs);
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DEFAULT_ELIGIBILITY = 'Verified students worldwide';

/** URL-safe slug from a title: strip diacritics, lowercase, non-alnum → single dash. */
export function slugify(s: string): string {
  return (s ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Comma list → trimmed, lowercased, de-duplicated, non-empty tags. */
export function parseTags(raw: string | undefined): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  for (const t of raw.split(',')) {
    const v = t.trim().toLowerCase();
    if (v) seen.add(v);
  }
  return [...seen];
}

/** Known attribute keys → the rows written to offer_attributes. Unknown keys drop. */
export function selectedAttributes(keys: string[]): { key: AttributeKey; label: string; points: number }[] {
  const out: { key: AttributeKey; label: string; points: number }[] = [];
  const done = new Set<string>();
  for (const k of keys) {
    if (done.has(k)) continue;
    const def = attributeByKey.get(k as AttributeKey);
    if (def) {
      out.push({ key: def.key, label: def.label, points: def.points });
      done.add(k);
    }
  }
  return out;
}

/** The full vocabulary, for rendering the editor's attribute chips. */
export const attributeVocabulary = ATTRIBUTES;

export interface OfferFormRaw {
  slug?: string;
  title?: string;
  provider?: string;
  category?: string;
  summary?: string;
  value?: string;
  body?: string;
  url?: string;
  verification?: string;
  eligibility?: string;
  offer_type?: string;
  discount_percent?: string;
  status?: string;
  affiliate?: boolean;
  sponsored?: boolean;
  featured?: boolean;
  tags?: string;
  expires_at?: string;
  ongoing?: boolean;
}

export interface OfferInput {
  slug?: string;
  title: string;
  provider: string;
  category: string;
  summary: string;
  value: string;
  body: string;
  url: string;
  verification: string;
  eligibility: string;
  offer_type: OfferType;
  discount_percent: number | null;
  status: OfferStatus;
  affiliate: boolean;
  sponsored: boolean;
  featured: boolean;
  tags: string[];
  expires_at: string | null;
}

export interface ValidationResult {
  errors: Record<string, string>;
  value: OfferInput | null;
}

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

/**
 * Validate + coerce a raw form submission into an OfferInput. Mirrors the DB
 * constraints so bad input is a friendly field error, not a 500. Slug uniqueness
 * is NOT checked here (it needs the DB) — the IO layer does that.
 */
export function validateOfferInput(raw: OfferFormRaw, opts: { requireSlug: boolean }): ValidationResult {
  const errors: Record<string, string> = {};

  const title = str(raw.title);
  const provider = str(raw.provider);
  const category = str(raw.category);
  const summary = str(raw.summary);
  const value = str(raw.value);
  const url = str(raw.url);
  const verification = str(raw.verification);

  if (!title) errors.title = 'Required';
  if (!provider) errors.provider = 'Required';
  if (!category) errors.category = 'Required';
  else if (!CATEGORIES.has(category)) errors.category = 'Unknown category';
  if (!summary) errors.summary = 'Required';
  if (!value) errors.value = 'Required';
  if (!verification) errors.verification = 'Required';
  if (!url) errors.url = 'Required';
  else if (!/^https?:\/\//i.test(url)) errors.url = 'Must start with http:// or https://';

  const offer_type = str(raw.offer_type) as OfferType;
  if (!offer_type) errors.offer_type = 'Required';
  else if (!OFFER_TYPES.includes(offer_type)) errors.offer_type = 'Invalid type';

  const status = (str(raw.status) || 'active') as OfferStatus;
  if (!STATUSES.includes(status)) errors.status = 'Invalid status';

  // discount_percent is required for and only for discount offers.
  let discount_percent: number | null = null;
  const dpRaw = str(raw.discount_percent);
  if (offer_type === 'discount') {
    const n = Number(dpRaw);
    if (!dpRaw || !Number.isInteger(n) || n < 1 || n > 100) {
      errors.discount_percent = 'Enter a whole number 1–100 for a discount offer';
    } else {
      discount_percent = n;
    }
  } else if (dpRaw) {
    errors.discount_percent = 'Only discount offers carry a percentage';
  }

  // slug: prefilled from the title on create; format-checked; uniqueness in IO.
  let slug: string | undefined;
  if (opts.requireSlug) {
    slug = str(raw.slug) || slugify(title);
    if (!slug) errors.slug = 'Required';
    else if (!SLUG_RE.test(slug)) errors.slug = 'Lowercase letters, numbers and single dashes only';
  }

  // expires_at: the "ongoing" checkbox wins and maps to null.
  let expires_at: string | null = null;
  if (!raw.ongoing) {
    const ex = str(raw.expires_at);
    if (ex) {
      if (Number.isNaN(Date.parse(ex))) errors.expires_at = 'Not a valid date';
      else expires_at = ex;
    }
  }

  if (Object.keys(errors).length > 0) return { errors, value: null };

  return {
    errors,
    value: {
      slug,
      title,
      provider,
      category,
      summary,
      value,
      body: typeof raw.body === 'string' ? raw.body : '',
      url,
      verification,
      eligibility: str(raw.eligibility) || DEFAULT_ELIGIBILITY,
      offer_type,
      discount_percent,
      status,
      affiliate: Boolean(raw.affiliate),
      sponsored: Boolean(raw.sponsored),
      featured: Boolean(raw.featured),
      tags: parseTags(raw.tags),
      expires_at,
    },
  };
}
