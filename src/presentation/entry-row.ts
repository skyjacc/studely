// The entry row — the register's only offer representation (Visual Direction
// v3 §3). This is the view model: one place that decides what a row knows and
// how it words it, so the row, the table and the front index cannot drift.
//
// It reads; it never computes. The score comes from score.ts, the trust facts
// from trust.ts, the outbound link from cta.ts. Category, summary and the
// provider logo are absent by construction: a row that cannot reach them
// cannot grow back into a card.

import type { OfferView } from '@domain/offers/offer-mapping';
import { formatScore, scoreWord, describeScore } from '@domain/offers/score';
import { deriveTrust, formatTrustDate, type TrustFacts, type TrustState } from '@domain/verification/trust';
import { offerCta, type OfferCta } from '@domain/affiliate/cta';
import { recordHref } from '@domain/offers/routes';
import { offerTypeLabel } from '@domain/offers/offers';

/**
 * What the single trust line says. One slot, read in one order:
 * a problem, else a human verification, else the automated stamp, else nothing.
 * That order is presentation only — on the record the human and automated
 * layers are still shown separately, as VD v3 §2 requires.
 */
export interface EntryTrust {
  kind: 'problem' | 'verified' | 'checked' | 'none';
  /** The whole line, composed from the parts below. What the table prints. */
  text: string;
  /** The words before the date — the row wraps the date itself in a <time>. */
  lead: string;
  /** Whatever closes the line after the date (a bracket, usually nothing). */
  trail: string;
  /** The machine-readable date behind those words, for <time datetime>. */
  date: Date | null;
  /** That same date, already written the one way the site writes dates. */
  dateText: string;
  /** Problem weight. Never the only carrier of meaning — the text says it too. */
  tone: 'warn' | 'bad' | null;
}

export interface EntryRowModel {
  /** Quiet mono index marker: `01`. */
  n: string;
  provider: string;
  title: string;
  /**
   * The record. A row always leads here — the title on desktop, the whole row
   * on mobile. The outbound transport is `action` alone, never this.
   */
  href: string;
  score: { text: string; word: string; label: string };
  value: string;
  /** Free · Discount · Credit · Free trial — a word on the value line, not a badge. */
  typeWord: string;
  /** `proof_method`, exactly as recorded (no vocabulary exists yet to normalise it). */
  proof: string;
  trust: EntryTrust;
  action: OfferCta;
  /** Commercial, not trust. Disclosed where policy requires it. */
  sponsored: boolean;
  /**
   * The outbound link is a partner link. A different fact from `sponsored` — one
   * is money earned on the click, the other a paid position — and both may be
   * true. The row discloses it because the reader can leave from the row.
   */
  affiliate: boolean;
}

/**
 * Words for a problem state — the one vocabulary. The row reads it here and
 * StateBadge (the record) reads the same map, so the register and the record
 * cannot describe the same checker state differently. The checker's own prose
 * never reaches a page.
 */
const PROBLEM_COPY: Record<TrustState, { lead: string; trail: string; tone: 'warn' | 'bad' }> = {
  expired: { lead: 'Ended', trail: '', tone: 'bad' },
  dead: { lead: 'Link failed (', trail: ')', tone: 'bad' },
  stale: { lead: 'Not checked since ', trail: '', tone: 'warn' },
  blocked: { lead: 'Provider blocks automated checks (', trail: ')', tone: 'warn' },
  // The note records that no response arrived, not which failure it was, so the
  // line says exactly that: naming a timeout would claim more than we stored.
  unreachable: { lead: 'Could not reach the page (', trail: ')', tone: 'warn' },
  unconfirmed: { lead: 'Last check could not confirm the page (', trail: ')', tone: 'warn' },
};

/**
 * The words for a problem state, told whether a date will follow them. Most of
 * them wrap the date in brackets, so without one the bracket has to go with it
 * — every caller asks here rather than trimming the string itself.
 */
export function problemWords(state: TrustState, hasDate: boolean): { lead: string; trail: string; tone: 'warn' | 'bad' } {
  const { lead, trail, tone } = PROBLEM_COPY[state];
  return hasDate ? { lead, trail, tone } : { lead: lead.replace(/\s*\($/, ''), trail: '', tone };
}

/**
 * Which one true thing a row leads with. The domain reports them all — an offer
 * can be expired AND unreachable AND overdue a check — but a row has one trust
 * line, so the choice belongs here. An offer that is over outranks a check that
 * could not confirm it, which outranks a check that is simply old.
 *
 * This is presentation only. The record shows the layers separately.
 */
const HEADLINE: readonly TrustState[] = ['expired', 'dead', 'blocked', 'unreachable', 'unconfirmed', 'stale'];

export function headlineState(facts: TrustFacts): TrustState | null {
  const present = new Set<TrustState>([...facts.problems, ...(facts.warning ? [facts.warning] : [])]);
  return HEADLINE.find((s) => present.has(s)) ?? null;
}

function slot(kind: EntryTrust['kind'], lead: string, trail: string, date: Date | null, tone: EntryTrust['tone']): EntryTrust {
  // One composition: the line the table prints and the parts the row prints
  // cannot say different things.
  const dateText = date ? formatTrustDate(date) : '';
  return { kind, text: date ? `${lead}${dateText}${trail}` : lead, lead, trail, date, dateText, tone };
}

function trustSlot(offer: OfferView, now: Date): EntryTrust {
  const t = deriveTrust(offer, now);
  const problem = headlineState(t);
  if (problem) {
    // "Ended" carries no date: the expiry is the offer's own field, not a check.
    const date = problem === 'expired' ? null : t.lastChecked;
    const p = problemWords(problem, Boolean(date));
    return slot('problem', p.lead, p.trail, date, p.tone);
  }
  if (t.verified) return slot('verified', 'Verified · ', '', t.verified, null);
  if (t.lastChecked) return slot('checked', 'Link checked ', '', t.lastChecked, null);
  // Nothing is backed: say nothing. An empty slot is the honest state — there
  // is no "Unverified" label anywhere on the site.
  return slot('none', '', '', null, null);
}

export function entryRowModel(offer: OfferView, index: number, now: Date = new Date()): EntryRowModel {
  const d = offer.data;
  return {
    n: String(index + 1).padStart(2, '0'),
    provider: d.provider,
    title: d.title,
    href: recordHref(offer.slug),
    score: { text: formatScore(d.score), word: scoreWord(d.score), label: describeScore(d.score) },
    value: d.value,
    typeWord: offerTypeLabel[d.offerType] ?? d.offerType,
    proof: d.proofMethod,
    trust: trustSlot(offer, now),
    action: offerCta(
      { slug: offer.slug, provider: d.provider, affiliate: d.affiliate, sponsored: d.sponsored, offerType: d.offerType, category: d.category },
      'row',
    ),
    sponsored: d.sponsored,
    affiliate: d.affiliate,
  };
}
