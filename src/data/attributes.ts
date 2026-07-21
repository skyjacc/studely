// The scoring vocabulary. Every point an offer scores must come from one of these,
// so "score: 9" is always answerable with "because of what?" — the kycnot.me model.
//
// Calibration: the DB trigger computes `score = clamp(5 + sum(points), 1, 10)`.
// Points are deliberately small; a best-in-class offer sums to about +5 and a
// poor one to about -3. Award positives sparingly — an attribute every offer has
// is noise, not signal.

export type AttributeKey =
  | 'bundle'
  | 'full_tier_free'
  | 'credit_grant'
  | 'many_discounts'
  | 'large_discount'
  | 'no_card_required'
  | 'instant_verification'
  | 'renewable'
  | 'worldwide'
  | 'card_required'
  | 'manual_application'
  | 'requires_other_program'
  | 'institution_gated'
  | 'credit_expires'
  | 'discount_only';

export interface AttributeDef {
  key: AttributeKey;
  /** Shown verbatim on the offer page next to its point value. */
  label: string;
  points: number;
  /** Grouping for the admin editor. */
  group: 'value' | 'access' | 'durability';
}

export const ATTRIBUTES: readonly AttributeDef[] = [
  // ---- what you actually get
  { key: 'bundle', label: 'Bundle of many paid products', points: 3, group: 'value' },
  { key: 'full_tier_free', label: 'Full paid tier, free', points: 2, group: 'value' },
  { key: 'credit_grant', label: 'Spendable credit, no card', points: 2, group: 'value' },
  { key: 'many_discounts', label: 'Hundreds of partner discounts', points: 2, group: 'value' },
  { key: 'large_discount', label: 'Discount of 50% or more', points: 2, group: 'value' },
  { key: 'discount_only', label: 'A discount, not a free tier', points: -1, group: 'value' },

  // ---- how hard it is to claim
  { key: 'no_card_required', label: 'No payment method needed', points: 1, group: 'access' },
  { key: 'instant_verification', label: 'Instant automated verification', points: 1, group: 'access' },
  { key: 'card_required', label: 'Credit card required up front', points: -2, group: 'access' },
  { key: 'manual_application', label: 'Manual application per item', points: -1, group: 'access' },
  { key: 'requires_other_program', label: 'Requires another program first', points: -1, group: 'access' },
  { key: 'institution_gated', label: 'Only if your school participates', points: -1, group: 'access' },

  // ---- how long it lasts
  { key: 'renewable', label: 'Renewable while you study', points: 1, group: 'durability' },
  { key: 'worldwide', label: 'Available worldwide', points: 1, group: 'durability' },
  { key: 'credit_expires', label: 'Credit expires after a term', points: -1, group: 'durability' },
] as const;

export const attributeByKey = new Map(ATTRIBUTES.map((a) => [a.key, a]));

/** Mirrors the DB trigger so the migration can be checked before it writes. */
export function scoreFrom(keys: AttributeKey[]): number {
  const total = keys.reduce((sum, k) => sum + (attributeByKey.get(k)?.points ?? 0), 0);
  return Math.max(1, Math.min(10, 5 + total));
}

/**
 * Attribute assignment for the 14 seed offers, read off their actual terms.
 * Where this disagrees with the old hand-typed score, the breakdown wins — that
 * disagreement is the whole point of making scores attributable.
 */
export const SEED_ATTRIBUTES: Record<string, AttributeKey[]> = {
  'github-student-pack': ['bundle', 'no_card_required', 'instant_verification'],
  'figma-education': ['full_tier_free', 'no_card_required', 'instant_verification'],
  'jetbrains-students': ['full_tier_free', 'no_card_required', 'instant_verification'],
  'azure-students': ['credit_grant', 'no_card_required', 'instant_verification', 'credit_expires'],
  'autodesk-education': ['full_tier_free', 'instant_verification'],
  'notion-education': ['full_tier_free', 'instant_verification'],
  'namecheap-student-domain': ['full_tier_free', 'no_card_required', 'requires_other_program', 'instant_verification'],
  'coursera-financial-aid': ['full_tier_free', 'no_card_required', 'worldwide', 'manual_application'],
  'spotify-premium-student': ['large_discount', 'instant_verification'],
  'canva-education': ['full_tier_free', 'no_card_required', 'institution_gated'],
  'perplexity-students': ['full_tier_free', 'no_card_required', 'institution_gated'],
  'apple-education-store': ['no_card_required', 'instant_verification'],
  'unidays-perks': ['many_discounts', 'instant_verification', 'discount_only'],
  // Was hand-scored 8. The card requirement is a real cost to a student with no
  // credit card, and the credit runs out — the breakdown says 5, and it is right.
  'google-cloud-credits': ['credit_grant', 'instant_verification', 'card_required', 'credit_expires'],
};
