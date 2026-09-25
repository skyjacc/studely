import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// The unit tests run outside Astro, so the `@domain` / `@ui` paths from
// tsconfig have to be repeated here for the ones that survive to runtime.
// Until now every aliased import inside a tested module was type-only and
// erased on transform; the entry-row model is the first that actually imports.
const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@core': r('./src/core'),
      '@domain': r('./src/domain'),
      '@services': r('./src/services'),
      '@ui': r('./src/presentation'),
    },
  },
});
