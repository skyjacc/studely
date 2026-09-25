import { describe, it, expect } from 'vitest';
import { entryRowModel, problemWords, headlineState } from './entry-row';
import { deriveTrust } from '@domain/verification/trust';
import { recordHref } from '@domain/offers/routes';
import type { OfferView } from '@domain/offers/offer-mapping';

// The entry row is the register's only offer representation (Visual Direction
// v3 §3). This model is what a row — and the table, and the front index — is
// allowed to know: everything is read from the domain, nothing is recomputed,
// and what the row must not show cannot be reached from here at all.

const NOW = new Date('2026-09-21T12:00:00Z');

function offer(over: Partial<OfferView['data']> = {}, verification: OfferView['verification'] = { verified: false, at: null }): OfferView {
  return {
    id: 'github-student-pack', slug: 'github-student-pack', body: '', attributes: [], verification,
    data: {
      title: 'GitHub Student Developer Pack', provider: 'GitHub', category: 'developer',
      summary: 'The biggest bundle of free developer tools for students.',
      value: '$200k+ in tools', offerType: 'free', score: 10,
      url: 'https://education.github.com/pack', affiliate: false, sponsored: false, featured: false,
      proofMethod: 'SheerID / school-issued email', eligibility: 'Students worldwide', expires: 'ongoing',
      lastChecked: new Date('2026-09-21T03:00:00Z'), lastCheckResult: 'pass', lastCheckNote: null,
      status: 'active', tags: [],
      ...over,
    },
  };
}

describe('entryRowModel — the slots', () => {
  it('reads every slot from the domain, in the register vocabulary', () => {
    const r = entryRowModel(offer(), 0, NOW);
    expect(r.n).toBe('01');
    expect(r.provider).toBe('GitHub');
    expect(r.title).toBe('GitHub Student Developer Pack');
    expect(r.href).toBe('/offers/github-student-pack');
    expect(r.score).toEqual({ text: '10 / 10', word: 'Excellent', label: 'Studely score 10 out of 10, Excellent' });
    expect(r.value).toBe('$200k+ in tools');
    expect(r.typeWord).toBe('Free');
    expect(r.proof).toBe('SheerID / school-issued email');
    expect(r.action.href).toBe('/go/github-student-pack');
    expect(r.action.label).toBe('View offer ↗');
  });

  it('numbers entries from one, two digits wide', () => {
    expect(entryRowModel(offer(), 1, NOW).n).toBe('02');
    expect(entryRowModel(offer(), 13, NOW).n).toBe('14');
    expect(entryRowModel(offer(), 99, NOW).n).toBe('100');
  });

  it('prints the proof exactly as recorded — no vocabulary normalisation', () => {
    expect(entryRowModel(offer({ proofMethod: 'School verification (teacher-invited…)' }), 0, NOW).proof)
      .toBe('School verification (teacher-invited…)');
  });

  it('cannot carry what the row must not show: no category, summary or logo', () => {
    const keys = Object.keys(entryRowModel(offer(), 0, NOW));
    expect(keys).not.toContain('category');
    expect(keys).not.toContain('summary');
    expect(keys).not.toContain('logo');
  });
});

describe('entryRowModel — destination policy', () => {
  // One policy, stated once: a row leads to the record, everywhere. /go is the
  // transport and appears only as the explicit action, which desktop shows and
  // mobile drops (VD v3 §3; Wireframes v3 screen 4 — "the whole row is the link
  // to the record … the action lives on the record"). The two are never mixed,
  // so the same row cannot mean different things on different widths.
  it('sends the row to the record and reserves /go for the explicit action', () => {
    const r = entryRowModel(offer(), 0, NOW);
    expect(r.href).toBe(recordHref('github-student-pack'));
    expect(r.href).not.toMatch(/^\/go\//);
    expect(r.action.href).toBe('/go/github-student-pack');
  });

  it('builds that record link from the route contract, not by hand', () => {
    expect(recordHref('a-slug')).toBe('/offers/a-slug');
    expect(entryRowModel(offer(), 0, NOW).href).toBe(recordHref(offer().slug));
  });
});

describe('entryRowModel — the trust slot', () => {
  const trust = (over: Partial<OfferView['data']>, v?: OfferView['verification']) =>
    entryRowModel(offer(over, v), 0, NOW).trust;

  it('shows the automated stamp when the latest check confirmed the page', () => {
    expect(trust({})).toEqual({
      kind: 'checked', text: 'Link checked Sep 21, 2026', lead: 'Link checked ', trail: '',
      date: new Date('2026-09-21T03:00:00Z'), dateText: 'Sep 21, 2026', tone: null,
    });
  });

  // The row prints the date inside a <time>, so the words come pre-split. The
  // full line is composed FROM those parts, so a component can never render a
  // sentence the model did not mean.
  it('splits the line around its date instead of leaving that to a regex', () => {
    const t = trust({ lastCheckResult: 'warn', lastCheckNote: 'blocked' });
    expect(t.lead).toBe('Provider blocks automated checks (');
    expect(t.trail).toBe(')');
    expect(t.text).toBe(`${t.lead}Sep 21, 2026${t.trail}`);
  });

  it('shows Verified only from a passing human record, and lets it replace the stamp', () => {
    const t = trust({}, { verified: true, at: '2026-09-18T09:00:00Z' });
    expect(t.kind).toBe('verified');
    expect(t.text).toBe('Verified · Sep 18, 2026');
  });

  it('says why a check could not confirm the page, in words, not in the checker\'s prose', () => {
    expect(trust({ lastCheckResult: 'warn', lastCheckNote: 'blocked' }).text).toBe('Provider blocks automated checks (Sep 21, 2026)');
    expect(trust({ lastCheckResult: 'warn', lastCheckNote: 'unreachable' }).text).toBe('Could not reach the page (Sep 21, 2026)');
    expect(trust({ lastCheckResult: 'warn', lastCheckNote: 'blocked' }).kind).toBe('problem');
  });

  it('reads problem > human verified > automated checked > none', () => {
    // a problem replaces the stamp even when a human verified the offer
    expect(trust({ status: 'unverified' }, { verified: true, at: '2026-09-18T09:00:00Z' }).kind).toBe('problem');
    // with no check date and no human record the slot stays empty rather than guessing
    expect(trust({ lastChecked: new Date(Number.NaN), lastCheckResult: null }))
      .toEqual({ kind: 'none', text: '', lead: '', trail: '', date: null, dateText: '', tone: null });
  });

  it('never writes the word Unverified', () => {
    for (const t of [trust({}), trust({ lastCheckResult: 'warn', lastCheckNote: 'blocked' }), trust({ status: 'unverified' })]) {
      expect(t.text).not.toMatch(/unverified/i);
    }
  });

  it('carries the problem tone as data, so the colour is never the only signal', () => {
    expect(trust({ lastCheckResult: 'warn', lastCheckNote: 'blocked' }).tone).toBe('warn');
    expect(trust({ expires: '2026-09-01' }).tone).toBe('bad');
    expect(trust({}).tone).toBeNull();
  });
});

describe('headlineState — the row leads with one thing', () => {
  // The domain reports every true fact. A row has one trust line, so the choice
  // of which to lead with is made here, and only here: an offer that is over
  // outranks a checker that could not confirm it, which outranks an old check.
  const facts = (over: Partial<OfferView['data']>, v?: OfferView['verification']) =>
    deriveTrust(offer(over, v), NOW);

  it('reads expired > dead > warning > stale', () => {
    expect(headlineState(facts({ expires: '2026-09-01', status: 'unverified', lastCheckResult: 'warn', lastCheckNote: 'blocked' }))).toBe('expired');
    expect(headlineState(facts({ status: 'unverified', lastCheckResult: 'warn', lastCheckNote: 'blocked' }))).toBe('dead');
    expect(headlineState(facts({ lastCheckResult: 'warn', lastCheckNote: 'blocked', lastChecked: new Date('2026-08-20T00:00:00Z') }))).toBe('blocked');
    expect(headlineState(facts({ lastChecked: new Date('2026-08-20T00:00:00Z') }))).toBe('stale');
  });

  it('has nothing to lead with when nothing is wrong', () => {
    expect(headlineState(facts({}))).toBeNull();
  });
});

describe('problemWords', () => {
  it('never leaves a bracket hanging when the state has no date to put in it', () => {
    expect(problemWords('blocked', false)).toEqual({ lead: 'Provider blocks automated checks', trail: '', tone: 'warn' });
    expect(problemWords('blocked', true)).toEqual({ lead: 'Provider blocks automated checks (', trail: ')', tone: 'warn' });
  });
});

describe('entryRowModel — commercial state', () => {
  it('keeps sponsorship separate from trust', () => {
    const r = entryRowModel(offer({ sponsored: true }), 0, NOW);
    expect(r.sponsored).toBe(true);
    expect(r.trust.kind).toBe('checked');
  });
});
