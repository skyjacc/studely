import { describe, it, expect } from 'vitest';
import {
  emptyState, parseState, serializeState, hasDirectoryKeys, isPristine, matches, compare, emptyMessage, type DirectoryState, type ItemFacets,
} from './directory-state';

const item = (over: Partial<ItemFacets> = {}): ItemFacets => ({
  text: 'github student developer pack github the biggest bundle developer tools',
  cat: 'dev-tools', type: 'free', verify: 'SheerID', card: 'no',
  score: 10, checked: 1_758_400_000_000, expires: 999999, name: 'github student developer pack',
  ...over,
});

describe('parseState / serializeState (URL is the source of truth)', () => {
  it('reads every key from a query string and lowercases the search', () => {
    const s = parseState(new URLSearchParams('q=Figma&sort=az&view=table&cat=design,cloud&type=free&verify=SheerID&card=no'));
    expect(s).toEqual({
      q: 'figma', sort: 'az', view: 'table',
      cat: new Set(['design', 'cloud']), type: new Set(['free']), verify: new Set(['SheerID']), card: new Set(['no']),
    });
  });

  it('ignores unknown sort and view values', () => {
    const s = parseState(new URLSearchParams('sort=bogus&view=grid'));
    expect(s.sort).toBe('score');
    expect(s.view).toBe('cards');
  });

  it('serialises only what differs from the defaults, in a stable order', () => {
    expect(serializeState(emptyState())).toBe('');
    const s: DirectoryState = { ...emptyState(), q: 'cloud', sort: 'checked', view: 'table', cat: new Set(['cloud', 'ai']) };
    expect(serializeState(s)).toBe('q=cloud&sort=checked&view=table&cat=cloud%2Cai');
  });

  it('round-trips', () => {
    const qs = 'q=azure&view=table&cat=cloud&type=credit';
    expect(serializeState(parseState(new URLSearchParams(qs)))).toBe(qs);
  });

  // The ad interruption appears only in the untouched default browse. The page
  // script used to decide that inline; the register asks the domain instead.
  it('reports a pristine state: the default sort, nothing searched, nothing filtered', () => {
    expect(isPristine(emptyState())).toBe(true);
    expect(isPristine({ ...emptyState(), view: 'table' })).toBe(true); // a view is not a filter
    expect(isPristine({ ...emptyState(), q: 'figma' })).toBe(false);
    expect(isPristine({ ...emptyState(), sort: 'az' })).toBe(false);
    expect(isPristine({ ...emptyState(), cat: new Set(['cloud']) })).toBe(false);
    expect(isPristine({ ...emptyState(), card: new Set(['no']) })).toBe(false);
  });

  it('reports whether a query string carries any directory key (URL beats localStorage only then)', () => {
    expect(hasDirectoryKeys(new URLSearchParams('utm_source=x'))).toBe(false);
    expect(hasDirectoryKeys(new URLSearchParams('cat=ai'))).toBe(true);
  });
});

describe('matches', () => {
  it('passes everything with an empty state', () => {
    expect(matches(item(), emptyState())).toBe(true);
  });

  it('applies the search against the prebuilt text', () => {
    expect(matches(item(), { ...emptyState(), q: 'bundle' })).toBe(true);
    expect(matches(item(), { ...emptyState(), q: 'figma' })).toBe(false);
  });

  it('ORs within a facet and ANDs across facets', () => {
    const s = { ...emptyState(), cat: new Set(['design', 'dev-tools']), type: new Set(['discount']) };
    expect(matches(item(), s)).toBe(false);
    expect(matches(item({ type: 'discount' }), s)).toBe(true);
  });

  it('can skip one facet — for live counts that must not zero out their own group', () => {
    const s = { ...emptyState(), cat: new Set(['design']) };
    expect(matches(item(), s)).toBe(false);
    expect(matches(item(), s, 'cat')).toBe(true);
  });
});

describe('compare', () => {
  const a = item({ score: 9, checked: 2, expires: 30, name: 'alpha' });
  const b = item({ score: 8, checked: 5, expires: 10, name: 'beta' });
  it('score: high to low', () => expect(compare(a, b, 'score')).toBeLessThan(0));
  it('checked: most recent first', () => expect(compare(a, b, 'checked')).toBeGreaterThan(0));
  it('expiring: soonest first', () => expect(compare(a, b, 'expiring')).toBeGreaterThan(0));
  it('az: by name', () => expect(compare(a, b, 'az')).toBeLessThan(0));
});

describe('emptyMessage', () => {
  it('names the search when one is active', () => {
    expect(emptyMessage({ ...emptyState(), q: 'adobe' })).toEqual({
      title: 'Nothing for "adobe"',
      why: 'No offer title, provider, summary or tag contains it.',
    });
  });
  it('names the filters otherwise', () => {
    expect(emptyMessage({ ...emptyState(), cat: new Set(['ai']), type: new Set(['credit']) })).toEqual({
      title: 'No offers match',
      why: 'Two filters are on. Loosen one, or reset them.',
    });
  });
});
