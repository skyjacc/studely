// robots.txt body. Pure so it can be unit-tested; the /robots.txt route only
// resolves the origin and returns this.
//
// Generated rather than a static public/robots.txt: the production origin comes
// from astro.config (PUBLIC_SITE_URL / the Vercel host), so a hardcoded file
// inevitably goes stale — the old one advertised a sitemap on a domain we do not
// own long after the brand and domain had changed.
export function robotsTxt(origin: URL): string {
  return [
    'User-agent: *',
    'Allow: /',
    // the operator tool is noindex'd in HTML too; this keeps crawlers off it entirely
    'Disallow: /admin',
    // /go/<slug> is the tracked exit: it writes an offer_clicks row and 302s to
    // the provider. Every crawler that walks those links logs a "click" nobody
    // made — 83% of rows had no referrer before this line. The links already
    // carry rel="nofollow"; this keeps the well-behaved crawlers out too.
    'Disallow: /go/',
    '',
    `Sitemap: ${new URL('sitemap-index.xml', origin).href}`,
    '',
  ].join('\n');
}
