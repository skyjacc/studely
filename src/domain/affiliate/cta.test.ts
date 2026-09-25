import { describe, it, expect } from 'vitest';
import { offerCta } from './cta';

const base = { slug: 'github-student-pack', provider: 'GitHub', affiliate: false, sponsored: false, offerType: 'free', category: 'dev-tools' };

describe('offerCta', () => {
  it('always routes through /go, never a provider or partner URL', () => {
    const c = offerCta(base);
    expect(c.href).toBe('/go/github-student-pack');
  });

  it('keeps the existing rel semantics: nofollow noopener, plus sponsored for partner links', () => {
    expect(offerCta(base).rel).toBe('nofollow noopener');
    expect(offerCta({ ...base, affiliate: true }).rel).toBe('sponsored nofollow noopener');
  });

  it('labels a register row generically and the record by destination', () => {
    expect(offerCta(base, 'row').label).toBe('View offer ↗');
    expect(offerCta(base, 'detail').label).toBe('Continue to GitHub ↗');
  });

  it('defaults to the row, the only placement the register has', () => {
    expect(offerCta(base)).toEqual(offerCta(base, 'row'));
  });

  it('carries the analytics attributes the click event reads', () => {
    expect(offerCta({ ...base, affiliate: true, sponsored: true }).data).toEqual({
      'data-go': '',
      'data-slug': 'github-student-pack',
      'data-category': 'dev-tools',
      'data-type': 'free',
      'data-sponsored': '1',
      'data-affiliate': '1',
    });
  });
});
