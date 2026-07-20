import type { APIRoute } from 'astro';

// Generated rather than a static public/robots.txt: the production origin comes
// from astro.config (PUBLIC_SITE_URL / the Vercel host), so a hardcoded file
// inevitably goes stale — the old one advertised a sitemap on a domain we do not
// own long after the brand and domain had changed.
export const GET: APIRoute = ({ site }) => {
  const origin = site ?? new URL('http://localhost:4321');
  const body = [
    'User-agent: *',
    'Allow: /',
    // the operator tool is noindex'd in HTML too; this keeps crawlers off it entirely
    'Disallow: /admin',
    '',
    `Sitemap: ${new URL('sitemap-index.xml', origin).href}`,
    '',
  ].join('\n');

  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
