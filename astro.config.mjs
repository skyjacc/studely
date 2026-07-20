// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Production origin — used for canonical URLs, the sitemap and Open Graph tags.
const SITE = 'https://claimly.com';
if (SITE.includes('.example')) {
  throw new Error('astro.config.mjs: set a real production domain in `site` (placeholder .example detected).');
}

export default defineConfig({
  site: SITE,
  integrations: [sitemap()],
  build: {
    inlineStylesheets: 'auto',
  },
});
