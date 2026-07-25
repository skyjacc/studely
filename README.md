# Studely

Trusted directory of verified student benefits. Public pages are prerendered
with Astro from published Supabase rows; staff maintain offers through the
server-rendered admin editor.

**Production:** `https://studely.app`

## Stack

- Astro 7 + TypeScript
- Supabase Postgres, Auth, RLS, and transactional RPCs
- Vercel static output plus serverless admin/actions
- Vitest
- Node 24

## Run

```bash
npm install
npm run dev
npm run check
npm test
npm run build
```

Local `.env` needs:

```dotenv
PUBLIC_SUPABASE_URL=
PUBLIC_SUPABASE_ANON_KEY=
```

Optional server-only values:

```dotenv
SUPABASE_SERVICE_ROLE_KEY=
VERCEL_DEPLOY_HOOK_URL=
PUBLIC_SITE_URL=https://studely.app
```

Never expose the service-role key or deploy-hook URL to browser code.

## Content operations

- `/admin/offers` lists all draft, published, and archived offers.
- `/admin/offers/new` creates a draft.
- `/admin/offers/<slug>` edits fields and scoring attributes.
- Published changes return an honest deploy status: triggered, skipped, or
  failed. Missing/broken hook never turns a successful DB save into a false
  success.
- Public pages read published offers from Supabase at build time.
- `/go/<slug>` logs an outbound click and redirects to affiliate URL when set,
  otherwise the official URL.

`score` is derived from `offer_attributes`; do not write it directly.

## Verification

```bash
npm run check-links
```

The checker:

- reads published offers through public RLS;
- classifies HTTP success, bot blocks, dead links, and expired dates;
- always writes `link-report.json`;
- writes one atomic batch to `link_checks` and updates
  `offers.last_checked/status` only when `SUPABASE_SERVICE_ROLE_KEY` is present.

GitHub Actions needs `SUPABASE_SERVICE_ROLE_KEY` before scheduled write-back is
enabled. Without it, the run is explicitly report-only.

## Database recovery

```bash
npm run db:backup
npm run db:export-seed
CONFIRM_RESTORE=RESTORE npm run db:restore
```

See:

- `docs/runbooks/database-recovery.md`
- `docs/runbooks/affiliate-programs.md`

Backups default to ignored `backups/`; keep an encrypted off-device copy.

## Deploy and domains

Vercel project remains named `claimly`; canonical product domain is
`studely.app`. `vercel.json` permanently redirects known legacy host
`claimly-seven.vercel.app` to the same path on `studely.app` after deployment.
Dynamic middleware also protects server-rendered production routes.

Do not enable AdSense units while Google review is pending. Existing consent,
verification script, and `ads.txt` remain unchanged.

## Structure

```text
src/
  actions/                 Astro Actions
  core/                    Supabase/config infrastructure
  domain/                  offers, verification, affiliate logic
  pages/                   public + dynamic admin routes
  presentation/            layouts, components, motion
  services/deploy/         Vercel deploy-hook adapter
scripts/
  check-links.mjs
  ops/                     backup, restore, seed export
supabase/migrations/
docs/runbooks/
```
