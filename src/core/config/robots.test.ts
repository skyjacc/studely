import { describe, it, expect } from 'vitest';
import { robotsTxt } from './robots';

describe('robotsTxt', () => {
  const body = robotsTxt(new URL('https://studely.app'));

  it('keeps crawlers off the admin and the tracked exit', () => {
    expect(body).toContain('Disallow: /admin');
    // /go/<slug> logs a click before redirecting; a crawler walking those links
    // fills offer_clicks with non-human rows.
    expect(body).toContain('Disallow: /go/');
  });

  it('advertises the sitemap on the configured origin', () => {
    expect(body).toContain('Sitemap: https://studely.app/sitemap-index.xml');
  });

  it('still allows everything else', () => {
    expect(body).toContain('User-agent: *\nAllow: /');
  });
});
