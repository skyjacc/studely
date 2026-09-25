import { describe, it, expect } from 'vitest';
import { catalogue, health, verification, outbound, dashboardMetrics, type MetricOffer } from './metrics';

// The dashboard's numbers, as readings of records. These fixtures deliberately
// DISAGREE with each other — an offer whose date has passed while the checker
// still calls it active, a check one day inside the threshold and one day
// outside — because a snapshot of today's database would pass whatever
// definition the implementation happened to pick.
//
// Contract: studely-vault/Design/Dashboard metric contract.md

const NOW = new Date('2026-09-26T12:00:00Z');
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);
const iso = (d: Date) => d.toISOString().slice(0, 10);

const offer = (over: Partial<MetricOffer> = {}): MetricOffer => ({
  slug: 'x', provider: 'Provider', title: 'An offer',
  visibility: 'published',
  expires: 'ongoing',
  lastChecked: daysAgo(1),
  lastCheckResult: 'pass',
  lastCheckNote: null,
  verified: false,
  status: 'active',
  ...over,
});

describe('catalogue', () => {
  it('counts each visibility for what it is', () => {
    const c = catalogue([offer(), offer(), offer({ visibility: 'draft' }), offer({ visibility: 'archived' })], NOW);
    expect(c.published).toBe(2);
    expect(c.drafts).toBe(1);
  });

  // D3: the date is the definition; offers.status is the checker's opinion of it
  it('reads an expiry from the date even when the checker still says active', () => {
    const c = catalogue([offer({ expires: iso(daysAgo(1)), status: 'active' })], NOW);
    expect(c.expired).toBe(1);
  });

  it('does not invent an expiry from the status column alone', () => {
    const c = catalogue([offer({ expires: 'ongoing', status: 'expired' })], NOW);
    expect(c.expired).toBe(0);
  });

  it('treats today as not yet expired, and ongoing as no date at all', () => {
    expect(catalogue([offer({ expires: iso(NOW) })], NOW).expired).toBe(0);
    expect(catalogue([offer({ expires: 'ongoing' })], NOW).expired).toBe(0);
  });

  it('counts only what is published as expired — a draft is not in the catalogue', () => {
    const c = catalogue([offer({ visibility: 'draft', expires: iso(daysAgo(5)) })], NOW);
    expect(c.expired).toBe(0);
  });
});

describe('health', () => {
  it('counts the latest check per offer, by result', () => {
    const h = health([
      offer(), offer(),
      offer({ lastCheckResult: 'warn', lastCheckNote: 'blocked' }),
      offer({ lastCheckResult: 'fail', lastCheckNote: null }),
      offer({ lastCheckResult: null, lastChecked: null }),
    ], NOW);
    expect(h).toMatchObject({ pass: 2, warn: 1, fail: 1, unchecked: 1 });
  });

  it('breaks the warnings down by what stopped the check', () => {
    const h = health([
      offer({ lastCheckResult: 'warn', lastCheckNote: 'blocked' }),
      offer({ lastCheckResult: 'warn', lastCheckNote: 'blocked' }),
      offer({ lastCheckResult: 'warn', lastCheckNote: 'unreachable' }),
      offer({ lastCheckResult: 'warn', lastCheckNote: null }),
    ], NOW);
    expect(h.warnings).toEqual({ blocked: 2, unreachable: 1, unconfirmed: 1 });
  });

  // D1: the threshold is the domain's, not the dashboard's
  it('calls a check stale one day past the threshold and fresh one day inside it', () => {
    expect(health([offer({ lastChecked: daysAgo(15) })], NOW).stale).toBe(1);
    expect(health([offer({ lastChecked: daysAgo(13) })], NOW).stale).toBe(0);
  });

  it('never calls a missing check stale — that is unchecked, a different thing', () => {
    const h = health([offer({ lastChecked: null, lastCheckResult: null })], NOW);
    expect(h.stale).toBe(0);
    expect(h.unchecked).toBe(1);
  });

  it('dates the catalogue by its newest check', () => {
    const h = health([offer({ lastChecked: daysAgo(5) }), offer({ lastChecked: daysAgo(2) })], NOW);
    expect(h.lastCheck).toEqual(daysAgo(2));
    expect(health([offer({ lastChecked: null })], NOW).lastCheck).toBeNull();
  });

  it('names what needs attention, in the register vocabulary', () => {
    const h = health([
      offer({ slug: 'autodesk', provider: 'Autodesk', lastCheckResult: 'warn', lastCheckNote: 'blocked' }),
      offer({ slug: 'azure', provider: 'Microsoft', lastCheckResult: 'warn', lastCheckNote: 'unreachable' }),
      offer(),
    ], NOW);
    expect(h.needsAttention).toHaveLength(2);
    expect(h.needsAttention[0]).toMatchObject({ slug: 'autodesk', provider: 'Autodesk', state: 'blocked' });
    expect(h.needsAttention[0].text).toMatch(/^Provider blocks automated checks/);
    expect(h.needsAttention[1].text).toMatch(/^Could not reach the page/);
  });

  it('puts an expired offer on the attention list too, and says so as such', () => {
    const h = health([offer({ expires: iso(daysAgo(2)), status: 'active' })], NOW);
    expect(h.needsAttention.map((a) => a.state)).toContain('expired');
  });

  it('reads only the published catalogue', () => {
    const h = health([offer({ visibility: 'draft', lastCheckResult: 'warn', lastCheckNote: 'blocked' })], NOW);
    expect(h).toMatchObject({ pass: 0, warn: 0, needsAttention: [] });
  });
});

describe('verification', () => {
  it('counts an offer only when its latest human check passed', () => {
    expect(verification([offer({ verified: true }), offer(), offer()]).verified).toBe(1);
  });

  it('reports zero as a number, because zero is the honest state today', () => {
    const v = verification([offer(), offer()]);
    expect(v.verified).toBe(0);
    expect(v).not.toHaveProperty('pending');
  });
});

describe('outbound', () => {
  const click = (d: Date) => ({ created_at: d.toISOString() });

  it('counts requests inside the window and ignores the ones outside it', () => {
    const o = outbound([click(daysAgo(1)), click(daysAgo(29)), click(daysAgo(31))], NOW);
    expect(o).toMatchObject({ requests: 2, days: 30 });
  });

  it('counts today and the last seven days beside the window', () => {
    const o = outbound([click(NOW), click(daysAgo(3)), click(daysAgo(20))], NOW);
    expect(o).toMatchObject({ today: 1, week: 2, requests: 3 });
  });

  // D2: this is a count of requests to /go. It is not a count of people.
  it('is named for what it counts, and claims nothing about who made them', () => {
    const o = outbound([click(NOW)], NOW);
    expect(Object.keys(o).sort()).toEqual(['days', 'requests', 'since', 'today', 'week']);
    expect(JSON.stringify(o)).not.toMatch(/click|visitor|user|traffic|demand/i);
  });

  it('skips a row whose date cannot be read rather than counting it as now', () => {
    expect(outbound([{ created_at: 'not-a-date' }, click(NOW)], NOW).requests).toBe(1);
  });
});

describe('dashboardMetrics', () => {
  it('composes the sections the contract lists, and no others', () => {
    const m = dashboardMetrics({ offers: [offer()], clicks: [], now: NOW });
    expect(Object.keys(m).sort()).toEqual(['catalogue', 'health', 'outbound', 'verification']);
  });

  it('invents no revenue, conversion or traffic section', () => {
    const m = dashboardMetrics({ offers: [offer()], clicks: [], now: NOW });
    expect(JSON.stringify(m)).not.toMatch(/revenue|conversion|epc|ctr|sessions/i);
  });
});
