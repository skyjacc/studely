import { describe, it, expect } from 'vitest';
import { slugify, parseTags, selectedAttributes, validateOfferInput, type OfferFormRaw } from './offer-input';

describe('slugify', () => {
  it('lowercases and dashes a title', () => {
    expect(slugify('GitHub Student Pack')).toBe('github-student-pack');
  });
  it('strips diacritics without inserting a dash mid-word', () => {
    expect(slugify('Naïve Café')).toBe('naive-cafe');
  });
  it('collapses punctuation and trims edge dashes', () => {
    expect(slugify('  Hello,  World!! ')).toBe('hello-world');
  });
});

describe('parseTags', () => {
  it('trims, lowercases and de-duplicates', () => {
    expect(parseTags('Dev, tools ,dev,')).toEqual(['dev', 'tools']);
  });
  it('returns [] for empty', () => {
    expect(parseTags('')).toEqual([]);
    expect(parseTags(undefined)).toEqual([]);
  });
});

describe('selectedAttributes', () => {
  it('maps known keys to rows, drops unknown, de-duplicates', () => {
    const rows = selectedAttributes(['no_card_required', 'bogus', 'no_card_required']);
    expect(rows).toEqual([{ key: 'no_card_required', label: 'No payment method needed', points: 1 }]);
  });
});

const base: OfferFormRaw = {
  title: 'Figma Education',
  provider: 'Figma',
  category: 'design',
  summary: 'Full Pro plan free for students.',
  value: 'Pro plan free',
  url: 'https://figma.com/education',
  verification: 'SheerID',
  offer_type: 'free',
  status: 'active',
};

describe('validateOfferInput', () => {
  it('accepts a valid create and fills slug + eligibility defaults', () => {
    const r = validateOfferInput(base, { requireSlug: true });
    expect(r.errors).toEqual({});
    expect(r.value?.slug).toBe('figma-education');
    expect(r.value?.eligibility).toBe('Verified students worldwide');
    expect(r.value?.discount_percent).toBeNull();
  });

  it('flags required fields', () => {
    const r = validateOfferInput({ offer_type: 'free', status: 'active' }, { requireSlug: true });
    expect(r.value).toBeNull();
    expect(r.errors.title).toBeDefined();
    expect(r.errors.url).toBeDefined();
    expect(r.errors.verification).toBeDefined();
  });

  it('rejects a non-http url', () => {
    expect(validateOfferInput({ ...base, url: 'figma.com' }, { requireSlug: true }).errors.url).toBeDefined();
  });

  it('rejects an unknown category', () => {
    expect(validateOfferInput({ ...base, category: 'nope' }, { requireSlug: true }).errors.category).toBe('Unknown category');
  });

  it('requires a percentage for a discount offer', () => {
    expect(validateOfferInput({ ...base, offer_type: 'discount' }, { requireSlug: true }).errors.discount_percent).toBeDefined();
  });

  it('accepts a valid discount percentage', () => {
    const r = validateOfferInput({ ...base, offer_type: 'discount', discount_percent: '50' }, { requireSlug: true });
    expect(r.errors).toEqual({});
    expect(r.value?.discount_percent).toBe(50);
  });

  it('rejects a percentage on a non-discount offer', () => {
    expect(validateOfferInput({ ...base, discount_percent: '50' }, { requireSlug: true }).errors.discount_percent).toBeDefined();
  });

  it('maps the ongoing checkbox to a null expiry', () => {
    const r = validateOfferInput({ ...base, expires_at: '2026-12-31', ongoing: true }, { requireSlug: true });
    expect(r.value?.expires_at).toBeNull();
  });

  it('passes a real expiry date through', () => {
    expect(validateOfferInput({ ...base, expires_at: '2026-12-31' }, { requireSlug: true }).value?.expires_at).toBe('2026-12-31');
  });

  it('rejects an invalid expiry date', () => {
    expect(validateOfferInput({ ...base, expires_at: 'someday' }, { requireSlug: true }).errors.expires_at).toBeDefined();
  });

  it('does not require or return a slug when editing', () => {
    const r = validateOfferInput(base, { requireSlug: false });
    expect(r.errors.slug).toBeUndefined();
    expect(r.value?.slug).toBeUndefined();
  });
});
