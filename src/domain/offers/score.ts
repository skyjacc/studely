// Presentation contract for the Studely score. The number itself is computed in
// the database (clamp(5 + Σ points, 1, 10), see 0001/0009) and never here —
// this module only decides how a stored score is shown and named.

export type ScoreTier = 'high' | 'mid' | 'low';

/** Defensive normalisation at the presentation boundary: integer, 1..10. */
export function clampScore(score: number): number {
  if (!Number.isFinite(score)) return 1;
  return Math.max(1, Math.min(10, Math.round(score)));
}

/** `8 / 10` — the only way a score is ever written in the UI. */
export function formatScore(score: number): string {
  return `${clampScore(score)} / 10`;
}

/**
 * The five-word scale (owner decision 4). The boundaries are a hypothesis to
 * be tested against reader behaviour, not a data rule: change them here and
 * nowhere else. Base score is 5, so "Fair" is the neutral starting point.
 */
export const SCORE_WORDS: readonly { min: number; max: number; word: string }[] = [
  { min: 1, max: 3, word: 'Weak' },
  { min: 4, max: 5, word: 'Fair' },
  { min: 6, max: 7, word: 'Good' },
  { min: 8, max: 8, word: 'Strong' },
  { min: 9, max: 10, word: 'Excellent' },
];

export function scoreWord(score: number): string {
  const s = clampScore(score);
  return SCORE_WORDS.find((w) => s >= w.min && s <= w.max)!.word;
}

/** Visual weight only (solid / soft / plain). Never the carrier of meaning. */
export function scoreTier(score: number): ScoreTier {
  const s = clampScore(score);
  return s >= 9 ? 'high' : s >= 7 ? 'mid' : 'low';
}

/** Accessible name: the meaning travels with the number. */
export function describeScore(score: number): string {
  return `Studely score ${clampScore(score)} out of 10, ${scoreWord(score)}`;
}
