// Pure input handling for the admin offer editor: slugging, validation, tag and
// attribute parsing. No Astro and no Supabase imports, so it is unit-testable in
// isolation. The IO layer (admin-offers.ts) calls these before it writes.

import { ATTRIBUTES, attributeByKey, type AttributeKey } from './attributes';
import { OFFER_FIELDS } from './offer-fields';
import type { OfferType, OfferStatus } from './offer-mapping';

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const HTTP_RE = /^https?:\/\//i;

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

/**
 * Raw form submission: a string per text-like control, a boolean per checkbox —
 * keyed by registry name — plus the two controls that are not columns.
 */
export type OfferFormRaw = Partial<Record<string, string | boolean>> & {
  slug?: string;
  ongoing?: boolean;
};

export interface OfferInput {
  slug?: string;
  title: string;
  provider: string;
  category: string;
  summary: string;
  value: string;
  body: string;
  url: string;
  /** Partner destination for /go; null when the offer has none. */
  affiliate_url: string | null;
  /** How a student proves eligibility (SheerID, school email, ISIC…). */
  proof_method: string;
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
 * Checks every registry field can state about itself: required, URL shape,
 * select membership. Rules that involve two fields (discount vs type, expiry
 * vs ongoing, affiliate vs affiliate_url) live in validateOfferInput.
 */
function genericErrors(raw: OfferFormRaw): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const f of OFFER_FIELDS) {
    if (f.input === 'checkbox') continue;
    const v = str(raw[f.name]);
    if (f.required && !v) errors[f.name] = 'Required';
    else if (f.input === 'url' && v && !HTTP_RE.test(v)) errors[f.name] = 'Must start with http:// or https://';
    else if (f.input === 'select' && v && f.options && !f.options.includes(v)) {
      errors[f.name] = `Unknown ${f.label.toLowerCase()}`;
    }
  }
  return errors;
}

/**
 * Validate + coerce a raw form submission into an OfferInput. Mirrors the DB
 * constraints so bad input is a friendly field error, not a 500. Slug uniqueness
 * is NOT checked here (it needs the DB) — the IO layer does that.
 */
export function validateOfferInput(raw: OfferFormRaw, opts: { requireSlug: boolean }): ValidationResult {
  const errors = genericErrors(raw);

  const title = str(raw.title);
  const offer_type = str(raw.offer_type) as OfferType;
  const status = (str(raw.status) || 'active') as OfferStatus;

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

  // A partner link without the disclosure flag would be an undisclosed affiliate
  // link on the public page. The flag is the operator's explicit choice — it is
  // never set for them — so the save is refused instead.
  const affiliate_url = str(raw.affiliate_url) || null;
  if (affiliate_url && !raw.affiliate && !errors.affiliate_url) {
    errors.affiliate_url = 'Affiliate URL is set. Enable "Affiliate link" before saving.';
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
      provider: str(raw.provider),
      category: str(raw.category),
      summary: str(raw.summary),
      value: str(raw.value),
      body: typeof raw.body === 'string' ? raw.body : '',
      url: str(raw.url),
      affiliate_url,
      proof_method: str(raw.proof_method),
      eligibility: str(raw.eligibility),
      offer_type,
      discount_percent,
      status,
      affiliate: Boolean(raw.affiliate),
      sponsored: Boolean(raw.sponsored),
      featured: Boolean(raw.featured),
      tags: parseTags(typeof raw.tags === 'string' ? raw.tags : undefined),
      expires_at,
    },
  };
}
