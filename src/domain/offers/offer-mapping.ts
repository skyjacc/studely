// Pure mapping from a Supabase `offers` row (+ its attribute rows) to the shape
// the public pages already expect from the old content collection. No Astro and
// no Supabase imports live here, so it is unit-testable with zero setup.

export type OfferType = 'free' | 'discount' | 'credit' | 'trial';
export type OfferStatus = 'active' | 'expiring' | 'expired' | 'unverified';

export interface OfferAttr {
  key: string;
  label: string;
  points: number;
}

export interface OfferData {
  title: string;
  provider: string;
  category: string;
  summary: string;
  value: string;
  offerType: OfferType;
  discountPercent?: number;
  /** Derived in the DB by trigger from offer_attributes; read-only here. */
  score: number;
  url: string;
  affiliate: boolean;
  sponsored: boolean;
  featured: boolean;
  verification: string;
  eligibility: string;
  /** ISO date string (YYYY-MM-DD), or the literal "ongoing". */
  expires: string;
  lastChecked: Date;
  status: OfferStatus;
  tags: string[];
}

/** A real verification signal — the latest human check from the verifications table. */
export interface OfferVerification {
  /** True only when the most recent verification passed. Never a guess. */
  verified: boolean;
  /** When that passing check happened (ISO), or null if never verified. */
  at: string | null;
}

export interface OfferView {
  /** Equals the slug, so /offers/[id] routing is unchanged. */
  id: string;
  slug: string;
  data: OfferData;
  /** Raw Markdown from offers.body. */
  body: string;
  attributes: OfferAttr[];
  /** Backed by the verifications table — not derived from status. */
  verification: OfferVerification;
}

/** One row of `select ... from offers`. snake_case, straight from Postgres. */
export interface OfferRow {
  /** uuid — used only to join attributes; not surfaced in OfferData. */
  id: string;
  slug: string;
  title: string;
  provider: string;
  category: string;
  summary: string;
  value: string;
  body: string;
  offer_type: OfferType;
  discount_percent: number | null;
  url: string;
  affiliate: boolean;
  sponsored: boolean;
  featured: boolean;
  verification: string;
  eligibility: string;
  tags: string[] | null;
  score: number;
  status: OfferStatus;
  expires_at: string | null;
  last_checked: string;
}

/** One row of `select offer_id,key,label,points from offer_attributes`. */
export interface AttrRow {
  offer_id: string;
  key: string;
  label: string;
  points: number;
}

export function mapOfferRow(
  row: OfferRow,
  attributes: OfferAttr[] = [],
  verification: OfferVerification = { verified: false, at: null },
): OfferView {
  return {
    id: row.slug,
    slug: row.slug,
    body: row.body ?? '',
    attributes,
    verification,
    data: {
      title: row.title,
      provider: row.provider,
      category: row.category,
      summary: row.summary,
      value: row.value,
      offerType: row.offer_type,
      ...(row.discount_percent != null ? { discountPercent: row.discount_percent } : {}),
      score: row.score,
      url: row.url,
      affiliate: row.affiliate,
      sponsored: row.sponsored,
      featured: row.featured,
      verification: row.verification,
      eligibility: row.eligibility,
      expires: row.expires_at ?? 'ongoing',
      lastChecked: new Date(row.last_checked),
      status: row.status,
      tags: row.tags ?? [],
    },
  };
}
