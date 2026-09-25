// Where an offer lives on this site. Two destinations exist and they mean
// different things, so both are named here rather than typed out at each call
// site:
//
//   recordHref  — /offers/<slug>, the record. Everything ABOUT an offer: the
//                 score and its reasons, the trust ledger, the account.
//   offerCta    — /go/<slug> (src/domain/affiliate/cta.ts), the transport. It
//                 logs the click and resolves affiliate_url → url →
//                 fallback_url, and it is only ever reached from an explicit
//                 action the reader chose.
//
// The register's policy follows from that split (Visual Direction v3 §3,
// Wireframes v3 screen 4): an entry row leads to the record — the title on
// desktop, the whole row on mobile — and `/go` appears only as the action,
// which desktop shows beside the row and mobile drops in favour of the one on
// the record. A row therefore means the same thing at every width.

/** The offer record. `slug` is the offer's slug, which is also its route id. */
export function recordHref(slug: string): string {
  return `/offers/${slug}`;
}
