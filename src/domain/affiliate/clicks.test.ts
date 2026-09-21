import { describe, it, expect } from 'vitest';
import { resolveTarget, goRedirect, type RedirectOffer } from './clicks';

const base: RedirectOffer = {
  id: '00000000-0000-0000-0000-000000000001',
  url: 'https://example.com/students',
  affiliate_url: null,
  fallback_url: null,
  tracking_source: null,
  tracking_campaign: null,
};

describe('resolveTarget', () => {
  it('prefers the affiliate link, then url, then fallback', () => {
    expect(resolveTarget({ ...base, affiliate_url: 'https://aff.example.com/x' })).toBe('https://aff.example.com/x');
    expect(resolveTarget(base)).toBe('https://example.com/students');
    expect(resolveTarget({ ...base, url: '', fallback_url: 'https://fb.example.com' })).toBe('https://fb.example.com');
    expect(resolveTarget({ ...base, url: '' })).toBeNull();
  });

  it('appends utm parameters only when tracking is set and not already present', () => {
    expect(resolveTarget({ ...base, tracking_source: 'studely', tracking_campaign: 'c1' })).toBe(
      'https://example.com/students?utm_source=studely&utm_campaign=c1',
    );
    expect(
      resolveTarget({ ...base, url: 'https://example.com/?utm_source=keep', tracking_source: 'studely' }),
    ).toBe('https://example.com/?utm_source=keep');
  });
});

describe('goRedirect', () => {
  it('is a 302 that is never cached and never indexed', () => {
    const res = goRedirect('https://example.com/students');
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('https://example.com/students');
    expect(res.headers.get('cache-control')).toBe('no-store');
    // The exit URL is not content; indexing it would surface /go/<slug> in
    // search results and send crawlers through the click log.
    expect(res.headers.get('x-robots-tag')).toBe('noindex');
  });
});
