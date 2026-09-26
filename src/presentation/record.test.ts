import { describe, it, expect } from 'vitest';
import { recordModel, RECORD_SECTIONS, NOT_VERIFIED } from './record';
import type { OfferView } from '@domain/offers/offer-mapping';

// The record answers six questions in a fixed order (Visual Direction v3 §4).
// Its model is where that order lives, along with the one rule the whole site
// turns on: the human layer and the automated layer are shown side by side and
// neither is ever spoken for by the other.

const NOW = new Date('2026-09-25T12:00:00Z');

function offer(over: Partial<OfferView['data']> = {}, verification: OfferView['verification'] = { verified: false, at: null }): OfferView {
  return {
    id: 'github-student-pack', slug: 'github-student-pack', body: '# Body', verification,
    attributes: [
      { key: 'bundle', label: 'Bundle of many paid products', points: 3 },
      { key: 'instant', label: 'Instant automated verification', points: 1 },
      { key: 'card', label: 'Credit card required up front', points: -2 },
    ],
    data: {
      title: 'GitHub Student Developer Pack', provider: 'GitHub', category: 'dev-tools',
      summary: 'The biggest bundle of free developer tools for students.',
      value: '$200k+ in tools', offerType: 'free', score: 10,
      url: 'https://education.github.com/pack', affiliate: false, sponsored: false, featured: false,
      proofMethod: 'SheerID / school-issued email', eligibility: 'Students 13+ in a degree course',
      expires: 'ongoing', lastChecked: new Date('2026-09-25T06:00:00Z'),
      lastCheckResult: 'pass', lastCheckNote: null, status: 'active', tags: [],
      updatedAt: '2026-09-20T12:00:00Z',
      ...over,
    },
  };
}
const model = (o = offer(), extra = {}) => recordModel({ offer: o, rank: 1, total: 14, related: [], history: {}, now: NOW, ...extra });

describe('the six questions, in order', () => {
  it('names them once, and the page follows that list', () => {
    expect(RECORD_SECTIONS).toEqual(['what is it', 'what do I get', 'who qualifies', 'why trust it', 'what do I do', 'where does it go']);
  });

  it('opens with the register row, so the reader does not re-learn the offer', () => {
    const r = model();
    expect(r.entry.provider).toBe('GitHub');
    expect(r.entry.title).toBe('GitHub Student Developer Pack');
    expect(r.entry.score.text).toBe('10 / 10');
    expect(r.entry.n).toBe('01');
    expect(r.position).toBe('Entry 01 of 14');
    expect(r.summary).toBe('The biggest bundle of free developer tools for students.');
  });

  it('states the value as a line, never as a type chip', () => {
    expect(model().whatYouGet).toEqual({ value: '$200k+ in tools', typeWord: 'Free' });
  });

  it('shows the score reasons as recorded, strongest first, and does not recompute the score', () => {
    const r = model();
    expect(r.why.heading).toBe('Why 10 / 10');
    expect(r.why.reasons.map((x) => [x.label, x.points])).toEqual([
      ['Bundle of many paid products', 3],
      ['Instant automated verification', 1],
      ['Credit card required up front', -2],
    ]);
    expect(r.why.base).toMatch(/base 5/i);
    expect(r.why.methodologyHref).toBe('/methodology');
  });
});

describe('why trust it — two layers, never one', () => {
  it('says exactly what is true when no human has checked', () => {
    const human = model().box.human;
    expect(human.kind).toBe('none');
    expect(human.sentence).toBe(NOT_VERIFIED);
    expect(NOT_VERIFIED).toBe('Not yet. No one at Studely has walked through this offer. We say so rather than guess.');
  });

  it('never writes the word Unverified', () => {
    expect(JSON.stringify(model())).not.toMatch(/unverified/i);
  });

  it('stamps the human layer only from a passing row', () => {
    const r = model(offer({}, { verified: true, at: '2026-09-18T09:00:00Z' }));
    expect(r.box.human).toMatchObject({ kind: 'verified', dateText: 'Sep 18, 2026' });
    const failed = model(offer({}, { verified: false, at: null }));
    expect(failed.box.human.kind).toBe('none');
  });

  it('keeps the automated layer beside the human one, not instead of it', () => {
    const r = model(offer({ lastCheckResult: 'warn', lastCheckNote: 'blocked' }, { verified: true, at: '2026-09-18T09:00:00Z' }));
    expect(r.box.human.kind).toBe('verified');
    expect(r.box.check.warning?.text).toBe('Provider blocks automated checks (Sep 25, 2026)');
    expect(r.box.check.dateText).toBe('Sep 25, 2026');
  });

  it('reports a clean check as a date and nothing more', () => {
    const r = model();
    expect(r.box.check).toMatchObject({ dateText: 'Sep 25, 2026', warning: null });
  });

  it('gives the offer-level problems their own row rather than folding them into the check', () => {
    const r = model(offer({ expires: '2026-09-01', lastCheckResult: 'warn', lastCheckNote: 'unreachable' }));
    expect(r.box.status.map((s) => s.text)).toContain('Ended');
    expect(r.box.check.warning?.text).toMatch(/^Could not reach the page/);
  });

  it('has no status row when nothing is wrong', () => {
    expect(model().box.status).toEqual([]);
  });
});

describe('what do I do, and where does it go', () => {
  it('routes the action through /go and names the destination it resolves to', () => {
    const r = model();
    expect(r.action.cta.href).toBe('/go/github-student-pack');
    expect(r.action.cta.label).toBe('Continue to GitHub ↗');
    expect(r.action.destinationHost).toBe('education.github.com');
  });

  it('states the money plainly, both ways', () => {
    // about THIS link, not about the site: what Studely earns overall is said
    // once, by moneyDisclosure, and would be wrong in a per-offer sentence the
    // day any other offer became a partner link
    expect(model().action.money).toBe('Not a partner link. Studely earns nothing if you use it.');
    expect(model(offer({ affiliate: true })).action.money)
      .toBe('Partner link. Studely may earn a commission; it never changes the score.');
  });

  it('never carries an affiliate URL into the page', () => {
    expect(JSON.stringify(model(offer({ affiliate: true })))).not.toMatch(/affiliate_url|utm_/i);
  });

  it('links the source to the provider itself', () => {
    expect(model().box.source).toEqual({ href: 'https://education.github.com/pack', label: 'Official GitHub page ↗' });
  });
});

describe('history and related', () => {
  it('carries the merged history, newest first', () => {
    const r = model(offer(), {
      history: {
        checks: [{ id: '1', checked_at: '2026-09-21T06:00:00Z', result: 'pass', note: null }],
        verifications: [{ id: 'v', checked_at: '2026-09-23T09:00:00Z', result: 'pass', note: null, evidence_url: null }],
      },
    });
    expect(r.history.map((e) => e.kind)).toEqual(['verification', 'check']);
  });

  it('renders related offers as register rows carrying their own register number', () => {
    const other = offer({ title: 'JetBrains: free for students', provider: 'JetBrains' });
    const r = model(offer(), { related: [{ offer: { ...other, slug: 'jetbrains-students' }, rank: 3 }] });
    expect(r.related).toHaveLength(1);
    expect(r.related[0].n).toBe('03');
    expect(r.related[0].href).toBe('/offers/jetbrains-students');
  });
});
