// The register's default order, in one place.
//
// `/` shows the head of the register and `/offers` shows all of it; if either
// sorted for itself, "the top of the register" would stop being the top of the
// register. Score first — it is the thing the register claims to rank by — then
// the most recently checked, so two equal scores are separated by how fresh our
// evidence is rather than by insertion order.
//
// `featured` and `sponsored` are deliberately absent: paying for a placement
// cannot buy a rank. The retired sortOffers put both first; that is the whole
// reason this comparator exists rather than being reused.

import type { OfferView } from './offer-mapping';

const checkedAt = (o: OfferView): number => {
  const t = o.data.lastChecked?.getTime?.();
  return Number.isFinite(t) ? (t as number) : 0;
};

export function defaultRegisterOrder(a: OfferView, b: OfferView): number {
  return b.data.score - a.data.score || checkedAt(b) - checkedAt(a);
}
