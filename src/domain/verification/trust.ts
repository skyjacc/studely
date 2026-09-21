// What the trust row may say about an offer, derived only from records.
//
// Vocabulary and order (owner decision 3): Score → Verified → Last checked →
// Proof → Who qualifies. "Verified" is the human check (a passing row in
// `verifications`); "Last checked" is the automated link checker; "Proof" is
// how a student proves eligibility; "Who qualifies" is the applicability text.
// The four are never mixed: nothing here infers one from another.

import type { OfferView } from '@domain/offers/offer-mapping';

/** Problem states — the only coloured things on the site (decision 5). */
export type TrustState = 'stale' | 'dead' | 'expired';

export interface TrustFacts {
  /** When the latest human verification passed; null when none has. */
  verified: Date | null;
  /** Latest automated check, or null when the row carries no usable date. */
  lastChecked: Date | null;
  proof: string;
  whoQualifies: string;
  /** Commercial state — separate from trust, shown where policy requires it. */
  sponsored: boolean;
  states: TrustState[];
}

/**
 * Hypothesis, activated together with the checker write-back (2026-09-21): the
 * checker runs weekly, so one missed run is "stale". Change here only.
 */
export const STALE_AFTER_DAYS = 14;

const DAY = 86_400_000;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function validDate(d: Date | null | undefined): Date | null {
  return d instanceof Date && Number.isFinite(d.getTime()) ? d : null;
}

export function deriveTrust(offer: OfferView, now: Date = new Date()): TrustFacts {
  const d = offer.data;
  const verified = offer.verification.verified && offer.verification.at ? validDate(new Date(offer.verification.at)) : null;
  const lastChecked = validDate(d.lastChecked);

  const states: TrustState[] = [];
  // Expired: a calendar date that has passed (compare as dates, not instants).
  if (ISO_DATE.test(d.expires) && d.expires < now.toISOString().slice(0, 10)) states.push('expired');
  // Dead: the checker demoted the offer after a real failure (link-check.ts).
  else if (d.status === 'unverified') states.push('dead');
  // Stale: a real check date, older than the threshold. Never from a missing date.
  else if (lastChecked && now.getTime() - lastChecked.getTime() > STALE_AFTER_DAYS * DAY) states.push('stale');

  return {
    verified,
    lastChecked,
    proof: d.proofMethod,
    whoQualifies: d.eligibility,
    sponsored: d.sponsored,
    states,
  };
}

/** `Sep 18, 2026` — one date format for every trust line. */
export function formatTrustDate(date: Date): string {
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
}
