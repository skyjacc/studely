// The record's history: what has actually happened to this offer, newest first.
//
// Every event comes from a row someone or something wrote — a link check, a
// human verification, the entry's own edit stamp, its end date. Nothing is
// derived from the projection on `offers`: last_checked and last_check_result
// describe the newest link_checks row, which is already here, and reading them
// again would show the same check twice as if it were two events.
//
// Pure: the page hands it rows, it hands back a list.

import type { CheckNote, CheckResult } from '@domain/offers/offer-mapping';

/** `link_checks`, as the public may read it (0015/0016). */
export interface CheckRow {
  id: string;
  checked_at: string;
  result: CheckResult;
  note: CheckNote | null;
}

/** `verifications` — the human layer, public since 0001. */
export interface VerificationRow {
  id: string;
  checked_at: string;
  result: CheckResult;
  note: string | null;
  evidence_url: string | null;
}

export type HistoryEvent =
  | { kind: 'check'; id: string; at: Date; result: CheckResult; note: CheckNote | null }
  | { kind: 'verification'; id: string; at: Date; result: CheckResult; note: string | null; evidenceUrl: string | null }
  | { kind: 'ends'; id: string; at: Date };

export interface HistorySources {
  checks?: CheckRow[];
  verifications?: VerificationRow[];
  /**
   * `offers.updated_at`. Accepted and deliberately unused: the set_updated_at
   * trigger fires on every write, and record_link_check_batch writes on every
   * run, so this stamp says "something touched the row", not "a person edited
   * the entry". The history would rather be shorter than say the wrong thing.
   */
  updatedAt?: string | null;
  /** `offers.expires_at`, or the literal "ongoing". */
  expires?: string | null;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** A date we can actually print, or nothing. A bad value is never dated "now". */
function date(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d : null;
}

export function recordHistory(sources: HistorySources): HistoryEvent[] {
  const events: HistoryEvent[] = [];

  for (const row of sources.checks ?? []) {
    const at = date(row.checked_at);
    if (at) events.push({ kind: 'check', id: row.id, at, result: row.result, note: row.note });
  }
  for (const row of sources.verifications ?? []) {
    const at = date(row.checked_at);
    if (at) events.push({ kind: 'verification', id: row.id, at, result: row.result, note: row.note, evidenceUrl: row.evidence_url });
  }
  // "ongoing" is the absence of an end date, not a date.
  if (sources.expires && ISO_DATE.test(sources.expires)) {
    const ends = date(sources.expires);
    if (ends) events.push({ kind: 'ends', id: 'ends', at: ends });
  }

  // Newest first; the row id breaks a tie so two checks written in the same
  // second do not swap places between builds.
  return events.sort((a, b) => b.at.getTime() - a.at.getTime() || a.id.localeCompare(b.id));
}
