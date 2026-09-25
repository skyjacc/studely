// The admin dashboard's numbers.
//
// Contract: studely-vault/Design/Dashboard metric contract.md — every metric
// here has a source, a definition and an empty state written down before it was
// computed. The rule the whole file exists to keep: **a metric is a reading of a
// record, not an impression.** Nothing here estimates, infers or fills a gap.
//
// It derives nothing of its own either. Expiry is `hasExpired`, staleness is
// `isStale`, the words for a state are `problemWords` — the same rules the
// register and the record read, so the admin cannot quietly disagree with the
// public site about what "stale" or "expired" means.
//
// Pure: it takes rows and returns numbers. The page does the reading.

import type { CheckNote, CheckResult } from '@domain/offers/offer-mapping';
import { hasExpired, isStale, type OfferProblem, type TrustState } from '@domain/verification/trust';
import { problemWords } from '@ui/entry-row';

/** What a metric needs to know about an offer. Whatever query supplies it. */
export interface MetricOffer {
  slug: string;
  provider: string;
  title: string;
  /** published · draft · archived */
  visibility: string;
  /** ISO date, or the literal "ongoing". The expiry is read from HERE. */
  expires: string;
  /** The newest automated check, or null when none has run. */
  lastChecked: Date | null;
  lastCheckResult: CheckResult | null;
  lastCheckNote: CheckNote | null;
  /** True only when the latest verifications row passed. */
  verified: boolean;
  /**
   * The checker's own status column. Carried so the shape matches the row, and
   * deliberately never read: it is an opinion about the expiry date, formed on
   * the checker's last run, and it goes stale the moment that run is missed.
   */
  status: string;
}

/** One row of `offer_clicks`, as the dashboard needs it. */
export interface ClickRow {
  created_at: string;
}

export interface CatalogueMetrics {
  published: number;
  drafts: number;
  /** Published offers whose own date has passed. */
  expired: number;
}

export interface AttentionItem {
  slug: string;
  provider: string;
  title: string;
  state: TrustState;
  /** The register's words for that state, date included where it has one. */
  text: string;
}

export interface HealthMetrics {
  pass: number;
  warn: number;
  fail: number;
  /** Published offers the checker has never reached. Not a failure — an absence. */
  unchecked: number;
  warnings: { blocked: number; unreachable: number; unconfirmed: number };
  /** The newest check the catalogue holds, or null when nothing has been checked. */
  lastCheck: Date | null;
  stale: number;
  needsAttention: AttentionItem[];
}

export interface VerificationMetrics {
  verified: number;
}

export interface OutboundMetrics {
  /** Requests to /go in the window. NOT people, and not clicks — see the contract. */
  requests: number;
  today: number;
  week: number;
  days: number;
  since: Date;
}

const DAY = 86_400_000;
const isPublished = (o: MetricOffer) => o.visibility === 'published';

/** A date we can read, or nothing. A bad value is never dated "now". */
function readDate(value: string): Date | null {
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d : null;
}

export function catalogue(offers: MetricOffer[], now: Date = new Date()): CatalogueMetrics {
  const published = offers.filter(isPublished);
  return {
    published: published.length,
    drafts: offers.filter((o) => o.visibility === 'draft').length,
    // The date, never the status column.
    expired: published.filter((o) => hasExpired(o.expires, now)).length,
  };
}

export function health(offers: MetricOffer[], now: Date = new Date()): HealthMetrics {
  const published = offers.filter(isPublished);
  const warnings = { blocked: 0, unreachable: 0, unconfirmed: 0 };
  const needsAttention: AttentionItem[] = [];
  let pass = 0, warn = 0, fail = 0, unchecked = 0, stale = 0, lastCheck: Date | null = null;

  for (const o of published) {
    if (o.lastCheckResult === 'pass') pass++;
    else if (o.lastCheckResult === 'warn') warn++;
    else if (o.lastCheckResult === 'fail') fail++;
    else unchecked++;

    if (o.lastChecked && (!lastCheck || o.lastChecked > lastCheck)) lastCheck = o.lastChecked;
    if (isStale(o.lastChecked, now)) stale++;

    const say = (state: TrustState) => {
      const date = state === 'expired' ? null : o.lastChecked;
      const { lead, trail } = problemWords(state, Boolean(date));
      const when = date ? date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }) : '';
      needsAttention.push({ slug: o.slug, provider: o.provider, title: o.title, state, text: `${lead}${when}${trail}` });
    };

    // The checker could not confirm the page.
    if (o.lastCheckResult === 'warn') {
      const note = (o.lastCheckNote ?? 'unconfirmed') as keyof typeof warnings;
      warnings[note]++;
      say(note as TrustState);
    }
    // Something is wrong with the offer itself. Reported beside the check, not instead of it.
    const problems: OfferProblem[] = [];
    if (hasExpired(o.expires, now)) problems.push('expired');
    if (o.lastCheckResult === 'fail') problems.push('dead');
    for (const p of problems) say(p);
  }

  return { pass, warn, fail, unchecked, warnings, lastCheck, stale, needsAttention };
}

export function verification(offers: MetricOffer[]): VerificationMetrics {
  // Zero is the state, not a missing number: nobody has walked through an offer yet.
  return { verified: offers.filter((o) => isPublished(o) && o.verified).length };
}

export function outbound(clicks: ClickRow[], now: Date = new Date(), days = 30): OutboundMetrics {
  const since = new Date(now.getTime() - days * DAY);
  const week = new Date(now.getTime() - 7 * DAY);
  const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dates = clicks.map((c) => readDate(c.created_at)).filter((d): d is Date => d !== null);
  return {
    requests: dates.filter((d) => d >= since).length,
    today: dates.filter((d) => d >= startOfToday).length,
    week: dates.filter((d) => d >= week).length,
    days,
    since,
  };
}

export interface DashboardInput {
  offers: MetricOffer[];
  clicks: ClickRow[];
  now?: Date;
}

export interface DashboardMetrics {
  catalogue: CatalogueMetrics;
  health: HealthMetrics;
  verification: VerificationMetrics;
  outbound: OutboundMetrics;
}

/**
 * The four sections the contract lists. There is no revenue, conversion or
 * traffic section because there is no source for one — an absent section is
 * honest where a zeroed card would imply the tracking exists.
 */
export function dashboardMetrics({ offers, clicks, now = new Date() }: DashboardInput): DashboardMetrics {
  return {
    catalogue: catalogue(offers, now),
    health: health(offers, now),
    verification: verification(offers),
    outbound: outbound(clicks, now),
  };
}
