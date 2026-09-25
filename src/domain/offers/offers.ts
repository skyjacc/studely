import type { OfferView } from './offer-mapping';

export type Offer = OfferView;

/** Days until an ISO date; null for "ongoing" / unparseable. */
export function daysUntil(expires: string): number | null {
  if (!expires || expires === 'ongoing') return null;
  const t = Date.parse(expires);
  if (Number.isNaN(t)) return null;
  return Math.ceil((t - Date.now()) / 86_400_000);
}

export function isExpired(offer: Offer): boolean {
  const d = daysUntil(offer.data.expires);
  return d !== null && d < 0;
}

export const offerTypeLabel: Record<string, string> = {
  free: 'Free',
  discount: 'Discount',
  credit: 'Credit',
  trial: 'Free trial',
};

export function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

/** Bucket the free-text proof method into a small facet set. */
export function verifyGroup(v: string): string {
  const s = v.toLowerCase();
  if (s.includes('sheerid')) return 'SheerID';
  if (s.includes('github')) return 'GitHub Pack';
  if (s.includes('unidays')) return 'UNiDAYS';
  if (s.includes('financial aid') || s.includes('application')) return 'Application';
  if (/\.edu|school|academic|email|documents|isic/.test(s)) return 'School email';
  return 'Other';
}

