import { describe, it, expect } from 'vitest';
import { deriveTrust, formatTrustDate } from './trust';
import type { OfferView } from '@domain/offers/offer-mapping';

const NOW = new Date('2026-09-21T12:00:00Z');

function offer(over: Partial<OfferView['data']> = {}, verification: OfferView['verification'] = { verified: false, at: null }): OfferView {
  return {
    id: 'x', slug: 'x', body: '', attributes: [], verification,
    data: {
      title: 'X', provider: 'P', category: 'design', summary: 's', value: 'v', offerType: 'free',
      score: 8, url: 'https://x', affiliate: false, sponsored: false, featured: false,
      proofMethod: 'SheerID', eligibility: 'Students', expires: 'ongoing',
      lastChecked: new Date('2026-09-21T10:00:00Z'), lastCheckResult: 'pass', lastCheckNote: null,
      status: 'active', tags: [], updatedAt: null,
      ...over,
    },
  };
}

describe('deriveTrust — honesty guards', () => {
  it('renders no Verified state without a human verification record', () => {
    const t = deriveTrust(offer(), NOW);
    expect(t.verified).toBeNull();
    expect(t.problems).toEqual([]);
  });

  it('never derives Verified from proof method, status or last_checked', () => {
    const t = deriveTrust(offer({ proofMethod: 'SheerID (verified)', status: 'active' }), NOW);
    expect(t.verified).toBeNull();
    expect(t.proof).toBe('SheerID (verified)');
    expect(t.lastChecked).toEqual(new Date('2026-09-21T10:00:00Z'));
  });

  it('shows Verified only when the latest human check passed', () => {
    const t = deriveTrust(offer({}, { verified: true, at: '2026-09-18T09:00:00Z' }), NOW);
    expect(t.verified).toEqual(new Date('2026-09-18T09:00:00Z'));
  });

  it('shows nothing for a failed latest human check', () => {
    const t = deriveTrust(offer({}, { verified: false, at: null }), NOW);
    expect(t.verified).toBeNull();
  });
});

describe('deriveTrust — independent facts, in no order', () => {
  // The domain reports what is true. Which of several true things a row leads
  // with is a presentation decision and lives in entry-row.ts; the record shows
  // the layers separately and never collapses them into one headline.
  it('reports the offer-level problems and the checker warning as separate facts', () => {
    const t = deriveTrust(offer({ lastCheckResult: 'warn', lastCheckNote: 'blocked', lastChecked: new Date('2026-08-20T00:00:00Z') }), NOW);
    expect(t.problems).toEqual(['stale']);
    expect(t.warning).toBe('blocked');
  });

  it('keeps an expiry and a warning side by side rather than picking one', () => {
    const t = deriveTrust(offer({ expires: '2026-09-01', lastCheckResult: 'warn', lastCheckNote: 'unreachable' }), NOW);
    expect(t.problems).toContain('expired');
    expect(t.warning).toBe('unreachable');
  });

  it('has no ordered states list for a caller to lean on', () => {
    expect((deriveTrust(offer(), NOW) as unknown as Record<string, unknown>).states).toBeUndefined();
  });

  it('reports the automated layer as a fact, whatever the human layer says', () => {
    const t = deriveTrust(offer({ lastCheckResult: 'warn', lastCheckNote: 'blocked' }, { verified: true, at: '2026-09-18T09:00:00Z' }), NOW);
    expect(t.verified).toEqual(new Date('2026-09-18T09:00:00Z'));
    expect(t.warning).toBe('blocked');
  });
});

describe('deriveTrust — problem states (only from real data)', () => {
  it('marks expired from a past expires date', () => {
    const t = deriveTrust(offer({ expires: '2026-09-01' }), NOW);
    expect(t.problems).toEqual(['expired']);
  });

  it('marks dead when the offer status is unverified (checker failure)', () => {
    const t = deriveTrust(offer({ status: 'unverified' }), NOW);
    expect(t.problems).toEqual(['dead']);
  });

  it('marks stale only when the check is older than the threshold', () => {
    const fresh = deriveTrust(offer({ lastChecked: new Date('2026-09-15T00:00:00Z') }), NOW);
    expect(fresh.problems).toEqual([]);
    const old = deriveTrust(offer({ lastChecked: new Date('2026-08-20T00:00:00Z') }), NOW);
    expect(old.problems).toEqual(['stale']);
  });

  it('does not invent stale from a missing date', () => {
    const t = deriveTrust(offer({ lastChecked: new Date(Number.NaN) }), NOW);
    expect(t.problems).toEqual([]);
  });

  // A warn is the checker saying "I could not confirm this", and the register
  // must not print it as a successful stamp. The state comes from the enum; the
  // wording is the presentation layer's job.
  it('names a blocked warn', () => {
    expect(deriveTrust(offer({ lastCheckResult: 'warn', lastCheckNote: 'blocked' }), NOW).warning).toBe('blocked');
  });

  it('names an unreachable warn', () => {
    expect(deriveTrust(offer({ lastCheckResult: 'warn', lastCheckNote: 'unreachable' }), NOW).warning).toBe('unreachable');
  });

  it('falls back to unconfirmed rather than reporting a warn as a clean check', () => {
    expect(deriveTrust(offer({ lastCheckResult: 'warn', lastCheckNote: null }), NOW).warning).toBe('unconfirmed');
  });

  it('reports no warning for a passing check', () => {
    expect(deriveTrust(offer({ lastCheckResult: 'pass' }), NOW).warning).toBeNull();
    expect(deriveTrust(offer({ lastCheckResult: 'pass' }), NOW).problems).toEqual([]);
  });

  it('marks sponsored as a commercial state, separately', () => {
    const t = deriveTrust(offer({ sponsored: true }), NOW);
    expect(t.sponsored).toBe(true);
    expect(t.problems).toEqual([]);
  });
});

describe('formatTrustDate', () => {
  it('prints a short, unambiguous date', () => {
    expect(formatTrustDate(new Date('2026-09-18T09:00:00Z'))).toBe('Sep 18, 2026');
  });
});
