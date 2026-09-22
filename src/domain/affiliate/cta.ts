// The outbound CTA contract. Every "go to the provider" link on the site is
// built here, so the transport (/go/<slug>, which logs the click and applies
// the affiliate_url → url → fallback_url precedence) and the rel semantics
// cannot drift between the card, the table and the detail page. affiliate_url
// itself never reaches the page.

export interface CtaOffer {
  slug: string;
  provider: string;
  affiliate: boolean;
  sponsored: boolean;
  offerType: string;
  category: string;
}

export interface OfferCta {
  href: string;
  rel: string;
  label: string;
  /** Spread onto the anchor; the click handler in Motion/analytics reads them. */
  data: Record<string, string>;
}

/**
 * Where the link sits. `row` is the register's entry row — the only offer
 * representation on the public site. `card` is its retired name, kept while the
 * last card-model consumers (home, related) are still standing; it resolves
 * identically and disappears with them.
 */
export type CtaPlacement = 'row' | 'card' | 'detail';

export function offerCta(o: CtaOffer, placement: CtaPlacement = 'row'): OfferCta {
  return {
    href: `/go/${o.slug}`,
    rel: o.affiliate ? 'sponsored nofollow noopener' : 'nofollow noopener',
    label: placement === 'detail' ? `Continue to ${o.provider} ↗` : 'View offer ↗',
    data: {
      'data-go': '',
      'data-slug': o.slug,
      'data-category': o.category,
      'data-type': o.offerType,
      'data-sponsored': o.sponsored ? '1' : '0',
      'data-affiliate': o.affiliate ? '1' : '0',
    },
  };
}
