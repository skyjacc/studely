// The record — six questions in a fixed order (Visual Direction v3 §4).
//
// It opens with the same row the register shows, so the reader never re-learns
// the offer, and then answers: what do I get, who qualifies, why trust it, what
// do I do, where does it go.
//
// The rule the whole site turns on lives here: the human layer (a verifications
// row) and the automated layer (a link check) are shown SIDE BY SIDE and
// neither speaks for the other. The row upstairs has one trust line and must
// choose (headlineState); the record has room for the truth and does not.

import type { OfferView } from '@domain/offers/offer-mapping';
import { deriveTrust, formatTrustDate, type OfferProblem } from '@domain/verification/trust';
import { recordHistory, type HistoryEvent, type HistorySources } from '@domain/verification/history';
import { offerTypeLabel } from '@domain/offers/offers';
import { offerCta, type OfferCta } from '@domain/affiliate/cta';
import { entryRowModel, problemWords, type EntryRowModel } from './entry-row';

/** The six questions, in the order the record answers them. */
export const RECORD_SECTIONS = [
  'what is it',
  'what do I get',
  'who qualifies',
  'why trust it',
  'what do I do',
  'where does it go',
] as const;

/**
 * The human layer with nothing in it. A sentence, not an empty box and not a
 * grey badge: it is the strongest true statement the data supports today, and
 * it is replaced by a stamp the moment a verifications row lands.
 */
export const NOT_VERIFIED =
  'Not yet. No one at Studely has walked through this offer. We say so rather than guess.';

/**
 * The money line under the action, about THIS link. It used to say "Studely
 * earns nothing" — a claim about the whole site inside a sentence about one
 * offer, which stops being true the day any other offer becomes a partner link.
 * What the site earns overall is said once, by moneyDisclosure.
 */
const MONEY = {
  plain: 'Not a partner link. Studely earns nothing if you use it.',
  partner: 'Partner link. Studely may earn a commission; it never changes the score.',
} as const;

/** Words for a state, with its date already in them. */
interface StateLine {
  text: string;
  lead: string;
  trail: string;
  dateText: string;
  tone: 'warn' | 'bad';
}

export interface RecordModel {
  /** The register row, unchanged — the record's header is the row. */
  entry: EntryRowModel;
  /** `Entry 01 of 14` — where this sits in the register. */
  position: string;
  summary: string;
  whatYouGet: { value: string; typeWord: string };
  why: {
    heading: string;
    reasons: { label: string; points: number }[];
    base: string;
    methodologyHref: string;
  };
  box: {
    whoQualifies: string;
    proof: string;
    /** The human layer: a stamp from a passing row, or the sentence. */
    human:
      | { kind: 'verified'; at: Date; dateText: string; note: string | null; evidenceHref: string | null; sentence?: undefined }
      | { kind: 'none'; sentence: string };
    /** The automated layer, reported whatever the human layer says. */
    check: { at: Date | null; dateText: string; warning: StateLine | null };
    /** What is wrong with the OFFER — its own row, never folded into the check. */
    status: StateLine[];
    source: { href: string; label: string };
  };
  action: { cta: OfferCta; destinationHost: string; money: string };
  history: HistoryEvent[];
  related: EntryRowModel[];
}

export interface RecordInput {
  offer: OfferView;
  /** Position in the register's default order, 1-based. */
  rank: number;
  total: number;
  /** Same-category entries, each with its own register rank. */
  related: { offer: OfferView; rank: number }[];
  history: HistorySources;
  now?: Date;
}

/** A state's words, with its date where the words expect it. */
function stateLine(state: OfferProblem | 'blocked' | 'unreachable' | 'unconfirmed', date: Date | null): StateLine {
  const { lead, trail, tone } = problemWords(state, Boolean(date));
  const dateText = date ? formatTrustDate(date) : '';
  return { text: `${lead}${dateText}${trail}`, lead, trail, dateText, tone };
}

/** The host a reader actually lands on. The affiliate URL never reaches a page. */
function destinationHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return '';
  }
}

export function recordModel({ offer, rank, total, related, history, now = new Date() }: RecordInput): RecordModel {
  const d = offer.data;
  const trust = deriveTrust(offer, now);
  const pad = (n: number) => String(n).padStart(2, '0');

  const human: RecordModel['box']['human'] = trust.verified
    ? {
        kind: 'verified',
        at: trust.verified,
        dateText: formatTrustDate(trust.verified),
        note: null,
        evidenceHref: null,
      }
    : { kind: 'none', sentence: NOT_VERIFIED };

  return {
    entry: entryRowModel(offer, rank - 1, now),
    position: `Entry ${pad(rank)} of ${total}`,
    summary: d.summary,
    whatYouGet: { value: d.value, typeWord: offerTypeLabel[d.offerType] ?? d.offerType },
    why: {
      heading: `Why ${offer.data.score} / 10`,
      // As recorded, strongest reason first. The number itself is the database's.
      reasons: [...offer.attributes].sort((a, b) => b.points - a.points).map((a) => ({ label: a.label, points: a.points })),
      base: 'Every offer starts at a base 5, and each named reason moves it. The result is clamped to 1–10.',
      methodologyHref: '/methodology',
    },
    box: {
      whoQualifies: trust.whoQualifies,
      proof: trust.proof,
      human,
      check: {
        at: trust.lastChecked,
        dateText: trust.lastChecked ? formatTrustDate(trust.lastChecked) : '',
        warning: trust.warning ? stateLine(trust.warning, trust.lastChecked) : null,
      },
      // `stale` belongs to the check's age, so it is dated by the check; an
      // expiry is the offer's own field and carries no check date.
      status: trust.problems.map((p) => stateLine(p, p === 'expired' ? null : trust.lastChecked)),
      source: { href: d.url, label: `Official ${d.provider} page ↗` },
    },
    action: {
      cta: offerCta(
        { slug: offer.slug, provider: d.provider, affiliate: d.affiliate, sponsored: d.sponsored, offerType: d.offerType, category: d.category },
        'detail',
      ),
      destinationHost: destinationHost(d.url),
      money: d.affiliate ? MONEY.partner : MONEY.plain,
    },
    history: recordHistory(history),
    related: related.map((r) => entryRowModel(r.offer, r.rank - 1, now)),
  };
}
