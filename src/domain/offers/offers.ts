import type { OfferView } from './offer-mapping';

export type Offer = OfferView;

/** Days until an ISO date; null for "ongoing" / unparseable. */
export function daysUntil(expires: string): number | null {
  if (!expires || expires === 'ongoing') return null;
  const t = Date.parse(expires);
  if (Number.isNaN(t)) return null;
  return Math.ceil((t - Date.now()) / 86_400_000);
}

export function isExpiringSoon(offer: Offer, withinDays = 30): boolean {
  const d = daysUntil(offer.data.expires);
  return d !== null && d >= 0 && d <= withinDays;
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

/** Featured + sponsored first, then most recently verified. */
export function sortOffers(offers: Offer[]): Offer[] {
  return [...offers].sort((a, b) => {
    const rank = (o: Offer) => (o.data.sponsored ? 2 : 0) + (o.data.featured ? 1 : 0);
    const r = rank(b) - rank(a);
    if (r !== 0) return r;
    return b.data.lastChecked.getTime() - a.data.lastChecked.getTime();
  });
}

export function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

/** Bucket the free-text verification into a small facet set. */
export function verifyGroup(v: string): string {
  const s = v.toLowerCase();
  if (s.includes('sheerid')) return 'SheerID';
  if (s.includes('github')) return 'GitHub Pack';
  if (s.includes('unidays')) return 'UNiDAYS';
  if (s.includes('financial aid') || s.includes('application')) return 'Application';
  if (/\.edu|school|academic|email|documents|isic/.test(s)) return 'School email';
  return 'Other';
}

/** Colour tier for the score badge. */
export function scoreTier(score: number): 'high' | 'mid' | 'low' {
  return score >= 9 ? 'high' : score >= 7 ? 'mid' : 'low';
}
