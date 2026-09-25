// The line under the heading, on both pages that head the register.
//
// It states three facts and no more: how many entries the register holds, when
// the checker last ran, and — only once a verifications row exists — how many
// entries a human has been through. With nothing verified it says nothing about
// verification, because "0 verified" and silence are different claims and only
// one of them is ours to make.

import type { OfferView } from '@domain/offers/offer-mapping';
import { formatTrustDate } from '@domain/verification/trust';

export interface RegisterStatus {
  /** The rendered line. Lowercase — the page uppercases it in CSS. */
  text: string;
  offers: number;
  verified: number;
  /** The newest check the register holds, or null when none carries a date. */
  lastChecked: Date | null;
}

export function registerStatus(offers: OfferView[]): RegisterStatus {
  const verified = offers.filter((o) => o.verification.verified).length;
  const lastChecked = offers.reduce<Date | null>((newest, o) => {
    const d = o.data.lastChecked;
    return d instanceof Date && Number.isFinite(d.getTime()) && (!newest || d > newest) ? d : newest;
  }, null);

  const parts = [`${offers.length} ${offers.length === 1 ? 'offer' : 'offers'}`];
  if (lastChecked) parts.push(`links checked ${formatTrustDate(lastChecked)}`);
  if (verified > 0) parts.push(`${verified} verified`);

  return { text: parts.join(' · '), offers: offers.length, verified, lastChecked };
}
