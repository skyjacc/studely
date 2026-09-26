// What Studely earns, counted from records.
//
// Three facts and nothing else: how many offers carry a partner link, how many
// carry a paid placement, and whether advertising is actually being served. No
// URL resolution (that is resolveTarget), no link semantics (cta.ts), and no
// wording — the sentence a reader sees is built in src/presentation/money.ts
// from what this returns.
//
// It exists because the site used to state its money position in five hand-typed
// sentences. The first partner link would have made four of them false at once,
// and nothing would have said so.

/** The AdSense configuration, as src/core/config/site.ts holds it. */
export interface AdsConfig {
  enabled: boolean;
  client: string;
  slots: Record<string, string>;
}

export interface MoneyFacts {
  /** Offers whose outbound link is a partner link. */
  affiliateLinks: number;
  /** Offers carrying a paid placement. A different thing, counted separately. */
  sponsoredOffers: number;
  adsRunning: boolean;
}

/** Just enough of an offer to count it. */
export interface MoneyOffer {
  affiliate: boolean;
  sponsored: boolean;
}

/**
 * Is advertising actually being served? One predicate, so no page decides for
 * itself. The account can be enabled and the client set while every slot id is
 * still empty — which is exactly today's state, and it means no ad has ever
 * rendered. AdSlot already refuses to render without a slot id; this says the
 * same thing in a sentence's terms.
 */
export function adsRunning(ads: AdsConfig): boolean {
  return Boolean(ads.enabled && ads.client && Object.values(ads.slots).some((id) => id));
}

/** Counts the offers it is given — the caller passes the published set. */
export function moneyPosition(offers: MoneyOffer[], ads: AdsConfig): MoneyFacts {
  return {
    affiliateLinks: offers.filter((o) => o.affiliate).length,
    sponsoredOffers: offers.filter((o) => o.sponsored).length,
    adsRunning: adsRunning(ads),
  };
}
