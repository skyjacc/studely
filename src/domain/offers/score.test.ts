import { describe, it, expect } from 'vitest';
import { formatScore, scoreWord, scoreTier, describeScore, SCORE_WORDS } from './score';

describe('formatScore', () => {
  it('renders the number over ten', () => {
    expect(formatScore(10)).toBe('10 / 10');
    expect(formatScore(7)).toBe('7 / 10');
  });

  it('clamps out-of-range and non-integer input at the presentation boundary', () => {
    expect(formatScore(0)).toBe('1 / 10');
    expect(formatScore(11)).toBe('10 / 10');
    expect(formatScore(7.6)).toBe('8 / 10');
    expect(formatScore(Number.NaN)).toBe('1 / 10');
  });
});

describe('scoreWord (hypothesis, not a data rule)', () => {
  it('maps the five levels of the working scale', () => {
    expect(scoreWord(1)).toBe('Weak');
    expect(scoreWord(3)).toBe('Weak');
    expect(scoreWord(4)).toBe('Fair');
    expect(scoreWord(5)).toBe('Fair');
    expect(scoreWord(6)).toBe('Good');
    expect(scoreWord(7)).toBe('Good');
    expect(scoreWord(8)).toBe('Strong');
    expect(scoreWord(9)).toBe('Excellent');
    expect(scoreWord(10)).toBe('Excellent');
  });

  it('exposes the scale for the methodology page', () => {
    expect(SCORE_WORDS.map((w) => w.word)).toEqual(['Weak', 'Fair', 'Good', 'Strong', 'Excellent']);
  });
});

describe('scoreTier', () => {
  it('keeps the existing three visual weights', () => {
    expect(scoreTier(10)).toBe('high');
    expect(scoreTier(9)).toBe('high');
    expect(scoreTier(8)).toBe('mid');
    expect(scoreTier(7)).toBe('mid');
    expect(scoreTier(6)).toBe('low');
  });
});

describe('describeScore', () => {
  it('gives an accessible name that carries the meaning, not only the number', () => {
    expect(describeScore(8)).toBe('Studely score 8 out of 10, Strong');
  });
});
