// What the trust row may say about an offer, derived only from records.
//
// Vocabulary and order (owner decision 3): Score → Verified → Last checked →
// Proof → Who qualifies. "Verified" is the human check (a passing row in
// `verifications`); "Last checked" is the automated link checker; "Proof" is
// how a student proves eligibility; "Who qualifies" is the applicability text.
// The four are never mixed: nothing here infers one from another.

import type { OfferView } from '@domain/offers/offer-mapping';

/**
 * Something wrong with the OFFER: its date has passed, the checker demoted it,
 * or nobody has checked it in too long. Independent of each other and of the
 * checker's warning below — more than one can be true at once.
 */
export type OfferProblem = 'stale' | 'dead' | 'expired';

/**
 * The checker could not confirm the page, and why. `unconfirmed` is the honest
 * fallback for a warn whose note is missing: a warn must never be reported as a
 * clean check.
 */
export type CheckWarning = 'blocked' | 'unreachable' | 'unconfirmed';

/** Everything the presentation layer may colour. The union is a vocabulary, not an order. */
export type TrustState = OfferProblem | CheckWarning;

export interface TrustFacts {
  /** When the latest human verification passed; null when none has. */
  verified: Date | null;
  /** Latest automated check, or null when the row carries no usable date. */
  lastChecked: Date | null;
  proof: string;
  whoQualifies: string;
  /** Commercial state — separate from trust, shown where policy requires it. */
  sponsored: boolean;
  /**
   * What is wrong with the offer, in no particular order. Which one a row leads
   * with is a presentation decision (see problemWords / entryRowModel); the
   * record shows the layers separately and never collapses them.
   */
  problems: OfferProblem[];
  /** Why the latest check could not confirm the page, or null when it did. */
  warning: CheckWarning | null;
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

  const problems: OfferProblem[] = [];
  // Expired: a calendar date that has passed (compare as dates, not instants).
  if (ISO_DATE.test(d.expires) && d.expires < now.toISOString().slice(0, 10)) problems.push('expired');
  // Dead: the checker demoted the offer after a real failure (link-check.ts).
  if (d.status === 'unverified') problems.push('dead');
  // Stale: a real check date, older than the threshold. Never from a missing date.
  if (lastChecked && now.getTime() - lastChecked.getTime() > STALE_AFTER_DAYS * DAY) problems.push('stale');

  // The automated layer's own verdict, reported whatever else is true.
  const warning: CheckWarning | null =
    d.lastCheckResult === 'warn' ? (d.lastCheckNote ?? 'unconfirmed') : null;

  return {
    verified,
    lastChecked,
    proof: d.proofMethod,
    whoQualifies: d.eligibility,
    sponsored: d.sponsored,
    problems,
    warning,
  };
}

/** `Sep 18, 2026` — one date format for every trust line. */
export function formatTrustDate(date: Date): string {
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
}
