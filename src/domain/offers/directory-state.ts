// The directory's filter state, pure. The URL is the source of truth (a shared
// link shows exactly what was shared); localStorage only fills in when the URL
// carries no directory key. The page script owns the DOM; this module owns
// what a state is, how it reads and writes, and what matches it.

export type SortKey = 'score' | 'checked' | 'expiring' | 'az';
export type ViewKey = 'cards' | 'table';
export type FacetKey = 'cat' | 'type' | 'verify' | 'card';

export const SORT_KEYS: readonly SortKey[] = ['score', 'checked', 'expiring', 'az'];
export const FACET_KEYS: readonly FacetKey[] = ['cat', 'type', 'verify', 'card'];
const DIRECTORY_KEYS = ['q', 'sort', 'view', ...FACET_KEYS];

export interface DirectoryState {
  /** lowercased, trimmed */
  q: string;
  sort: SortKey;
  view: ViewKey;
  cat: Set<string>;
  type: Set<string>;
  verify: Set<string>;
  card: Set<string>;
}

/** What each rendered item carries in its data-* attributes. */
export interface ItemFacets {
  text: string;
  cat: string;
  type: string;
  verify: string;
  card: string;
  score: number;
  /** epoch ms of the last automated check */
  checked: number;
  /** days until expiry; 999999 = ongoing (sorts last) */
  expires: number;
  /** lowercased title, for A→Z */
  name: string;
}

export function emptyState(): DirectoryState {
  return { q: '', sort: 'score', view: 'cards', cat: new Set(), type: new Set(), verify: new Set(), card: new Set() };
}

export function hasDirectoryKeys(params: URLSearchParams): boolean {
  return DIRECTORY_KEYS.some((k) => params.has(k));
}

/**
 * Untouched default browse: no search, no facet, the default sort. The in-feed
 * ad cadence is allowed only here — an ad must never trail a filtered subset.
 * The view is not part of it: switching Index/Table narrows nothing.
 */
export function isPristine(s: DirectoryState): boolean {
  return !s.q && s.sort === 'score' && FACET_KEYS.every((f) => s[f].size === 0);
}

export function parseState(params: URLSearchParams): DirectoryState {
  const s = emptyState();
  s.q = (params.get('q') ?? '').trim().toLowerCase();
  const sort = params.get('sort');
  if (sort && (SORT_KEYS as readonly string[]).includes(sort)) s.sort = sort as SortKey;
  if (params.get('view') === 'table') s.view = 'table';
  for (const f of FACET_KEYS) {
    s[f] = new Set((params.get(f) ?? '').split(',').filter(Boolean));
  }
  return s;
}

/** Only the non-default parts, in one stable order — an empty state is ''. */
export function serializeState(s: DirectoryState, rawQuery = s.q): string {
  const p = new URLSearchParams();
  if (s.q) p.set('q', rawQuery.trim());
  if (s.sort !== 'score') p.set('sort', s.sort);
  if (s.view !== 'cards') p.set('view', s.view);
  for (const f of FACET_KEYS) if (s[f].size) p.set(f, [...s[f]].join(','));
  return p.toString();
}

/**
 * Does an item pass the state? OR inside a facet, AND across facets. `skip`
 * ignores one facet — live counts are computed against every OTHER active
 * filter, otherwise picking one category would zero out the rest of its group.
 */
export function matches(item: ItemFacets, s: DirectoryState, skip?: FacetKey): boolean {
  if (s.q && !item.text.includes(s.q)) return false;
  for (const f of FACET_KEYS) {
    if (f === skip) continue;
    if (s[f].size && !s[f].has(item[f])) return false;
  }
  return true;
}

export function compare(a: ItemFacets, b: ItemFacets, sort: SortKey): number {
  if (sort === 'checked') return b.checked - a.checked;
  if (sort === 'expiring') return a.expires - b.expires;
  if (sort === 'az') return a.name.localeCompare(b.name);
  return b.score - a.score;
}

/** The empty-state copy: names the search when there is one, else the filters. */
export function emptyMessage(s: DirectoryState, rawQuery = s.q): { title: string; why: string } {
  if (s.q) {
    return { title: `Nothing for "${rawQuery.trim()}"`, why: 'No offer title, provider, summary or tag contains it.' };
  }
  const n = FACET_KEYS.reduce((sum, f) => sum + s[f].size, 0);
  const words = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const count = n < words.length ? words[n] : String(n);
  return {
    title: 'No offers match',
    why: n === 1 ? 'One filter is on. Loosen it, or reset.' : `${count} filters are on. Loosen one, or reset them.`,
  };
}
