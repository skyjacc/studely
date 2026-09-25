// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';

// Production origin — drives canonical URLs, the sitemap and Open Graph tags.
// There is no custom domain yet, so this follows whatever Vercel assigns:
// VERCEL_PROJECT_PRODUCTION_URL is the stable production host (no protocol).
// Hardcoding a domain we do not own would point every canonical at someone else.
// Set PUBLIC_SITE_URL to override once a real domain is bought.
const SITE =
  process.env.PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : 'http://localhost:4321');

export default defineConfig({
  site: SITE,
  // /categories was an index of an index: the register's chips already carry
  // every category with a live count, and nothing has linked to the page since
  // the front index was rebuilt. It is retired rather than deleted — the URL is
  // in the sitemap and may be indexed, so it keeps its link equity by pointing
  // at what replaced it. 301, not 308: this is a permanent move of a GET page.
  // (/category/<slug> is a separate legacy route and still redirects itself.)
  redirects: {
    '/categories': { status: 301, destination: '/offers' },
  },
  // Every page is prerendered by default and served as static HTML — the whole
  // public directory stays fast and free to serve. Only the routes that opt out
  // with `export const prerender = false` (admin, API, auth) run on demand.
  adapter: vercel(),
  // The admin is not part of the public site — keep it out of the sitemap that
  // robots.txt advertises, so crawlers are not handed the login page.
  integrations: [sitemap({ filter: (page) => !new URL(page).pathname.startsWith('/admin') })],
  build: {
    inlineStylesheets: 'auto',
  },
});
