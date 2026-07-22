// In-feed ad density. Kept proportional to the catalogue, capped, and off for
// short lists — a directory of a handful of offers should not carry ads at all,
// and a long one should not be overrun. Quality over fill rate: AdSense rewards
// fewer, well-placed units on good content, and a wall of ads reads as spam.

/** One in-feed ad per this many offers. */
export const AD_INTERVAL = 6;
/** Never more than this many in-feed ads in one grid, however long it is. */
export const AD_MAX = 4;

/**
 * Zero-based offer indices AFTER which an in-feed ad card should appear.
 * Empty when the list is shorter than one interval; never trails the last offer.
 *   14 offers → [5, 11]        (2 ads)
 *   40 offers → [5, 11, 17, 23] (capped at 4)
 *    5 offers → []             (too short)
 */
export function adAfterIndexes(offerCount: number): number[] {
  if (offerCount < AD_INTERVAL) return [];
  const out: number[] = [];
  for (let i = AD_INTERVAL - 1; i < offerCount - 1 && out.length < AD_MAX; i += AD_INTERVAL) {
    out.push(i);
  }
  return out;
}
