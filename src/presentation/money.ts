// The one sentence about money, written from the facts.
//
// The footer, /about, /methodology and the disclosure policy all print this.
// Before it, each of them held its own hand-typed version — and every one of
// them said "Studely earns nothing today". The first partner link would have
// made four statements false in the same instant, with nothing to catch it.
//
// So the sentence is derived, and only the presenter knows the words. What is
// true in every state — payment never buys a better score — is stated in every
// state; what is only true today is stated only today.

import type { MoneyFacts } from '@domain/affiliate/position';

export type MoneyState = 'nothing' | 'affiliate' | 'ads' | 'both';

export interface MoneyDisclosure {
  state: MoneyState;
  /** The full sentence, for a footer or a paragraph. */
  text: string;
  /** The same fact in four words, for a tight space. */
  short: string;
}

const NEVER = 'Payment never buys a better score.';

function stateOf(facts: MoneyFacts): MoneyState {
  const money = facts.affiliateLinks > 0;
  if (money && facts.adsRunning) return 'both';
  if (money) return 'affiliate';
  if (facts.adsRunning) return 'ads';
  return 'nothing';
}

/** `2 partner links` / `one partner link` — the count, in words a reader reads. */
function links(n: number): string {
  return n === 1 ? 'one offer here is a partner link' : `${n} offers here are partner links`;
}

export function moneyDisclosure(facts: MoneyFacts): MoneyDisclosure {
  const state = stateOf(facts);
  // A paid placement is not income from a link, so it is disclosed wherever it
  // exists — including in the state where nothing else earns.
  const sponsored = facts.sponsoredOffers > 0
    ? ` ${facts.sponsoredOffers === 1 ? 'One offer carries a sponsored placement' : `${facts.sponsoredOffers} offers carry sponsored placements`}, labelled as such.`
    : '';

  const text = {
    nothing:
      `Studely earns nothing today: no offer here is a partner link and no advertising is running. ` +
      `We intend to add both, and will say so plainly here and on the offer itself when we do.${sponsored} ${NEVER}`,
    affiliate:
      `Studely earns from partner links: ${links(facts.affiliateLinks)}, and each one is labelled where it appears. ` +
      `You never pay more because a link is a partner link. No advertising is running.${sponsored} ${NEVER}`,
    ads:
      `Studely earns from advertising: ads are served on this site by Google. ` +
      `No offer here is a partner link.${sponsored} ${NEVER}`,
    both:
      `Studely earns from partner links and from advertising: ${links(facts.affiliateLinks)}, each labelled where it appears, ` +
      `and ads are served by Google. You never pay more because a link is a partner link.${sponsored} ${NEVER}`,
  }[state];

  const short = {
    nothing: 'Earns nothing today',
    affiliate: 'Some links are partner links',
    ads: 'Advertising supported',
    both: 'Partner links and advertising',
  }[state];

  return { state, text, short };
}
