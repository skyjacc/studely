export type OfferHealthStatus = 'active' | 'expiring' | 'expired' | 'unverified';
export type LinkCheckResult = 'pass' | 'warn' | 'fail';
export type ReportStatus = 'ok' | 'BLOCKED' | 'UNREACHABLE' | 'DEAD' | 'EXPIRED';

export interface CheckedOffer {
  id: string;
  slug: string;
  title: string;
  url: string | null;
  /** Postgres date (`YYYY-MM-DD`), or null for ongoing. */
  expires: string | null;
  status: OfferHealthStatus;
}

export interface LinkObservation {
  /** Final HTTP status. Zero means no HTTP response was received. */
  status: number;
  finalUrl?: string;
  error?: string;
}

export interface VerificationWrite {
  offer_id: string;
  result: LinkCheckResult;
  /** True means the destination is reachable or only bot-blocked. */
  ok: boolean;
  status_code: number | null;
  error: string | null;
  final_url: string | null;
  checked_at: string;
  offer_status: OfferHealthStatus;
}

export interface ClassifiedOfferCheck {
  reportStatus: ReportStatus;
  write: VerificationWrite;
}

const BLOCKED_CODES = new Set([401, 403, 405, 406, 429]);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * A Postgres `date` means the offer remains valid through that calendar date.
 * Compare date strings in UTC instead of parsing midnight and expiring it at
 * 00:00 on the stated day.
 */
function hasExpired(expires: string | null, checkedAt: Date): boolean {
  if (!expires || !ISO_DATE.test(expires)) return false;
  return expires < checkedAt.toISOString().slice(0, 10);
}

function healthyStatus(current: OfferHealthStatus): OfferHealthStatus {
  return current === 'expiring' ? 'expiring' : 'active';
}

export function classifyOfferCheck(
  offer: CheckedOffer,
  observation: LinkObservation,
  checkedAt = new Date(),
): ClassifiedOfferCheck {
  const expired = hasExpired(offer.expires, checkedAt);
  const receivedHttp = Number.isInteger(observation.status) && observation.status > 0;
  const blocked = receivedHttp && BLOCKED_CODES.has(observation.status);
  const passed = receivedHttp && observation.status < 400;
  // No HTTP response at all: a timeout, DNS failure, reset connection or TLS
  // error. That is us failing to reach the offer, not the provider saying the
  // page is gone — and it is what aggressive bot protection looks like when it
  // drops the connection instead of answering 403. Treating it as dead would
  // publish "this offer is broken" on the strength of our own failed request.
  // Warn instead: it shows up in the report, but never demotes the offer.
  const unreachable = !receivedHttp;

  const result: LinkCheckResult = passed ? 'pass' : blocked || unreachable ? 'warn' : 'fail';
  const ok = result !== 'fail';
  const reportStatus: ReportStatus = expired
    ? 'EXPIRED'
    : result === 'pass'
      ? 'ok'
      : unreachable
        ? 'UNREACHABLE'
        : result === 'warn'
          ? 'BLOCKED'
          : 'DEAD';

  return {
    reportStatus,
    write: {
      offer_id: offer.id,
      result,
      ok,
      status_code: receivedHttp ? observation.status : null,
      error: observation.error ?? null,
      final_url: observation.finalUrl ?? null,
      checked_at: checkedAt.toISOString(),
      offer_status: expired ? 'expired' : ok ? healthyStatus(offer.status) : 'unverified',
    },
  };
}

/**
 * Defensive de-duplication before the transactional RPC. Preserve first-seen
 * order for stable reports, while keeping the newest result for a repeated ID.
 */
export function dedupeWrites(writes: VerificationWrite[]): VerificationWrite[] {
  const indexByOffer = new Map<string, number>();
  const out: VerificationWrite[] = [];
  for (const write of writes) {
    const index = indexByOffer.get(write.offer_id);
    if (index === undefined) {
      indexByOffer.set(write.offer_id, out.length);
      out.push(write);
    } else {
      out[index] = write;
    }
  }
  return out;
}
