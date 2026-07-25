# Database Backup and Recovery

## What is protected

Studely uses three layers:

1. Supabase platform backups/PITR for full managed recovery, including `auth`.
2. `npm run db:backup` for application schema plus non-profile `public` data.
3. `npm run db:export-seed` for reviewable public catalogue JSON.

`public.profiles` and `auth.users` are deliberately excluded from portable content dumps. Restore identities through Supabase platform recovery; copying auth rows between projects is not a safe seed mechanism.

## Backup

Use Supabase dashboard connection string. Prefer direct connection or session pooler.

```bash
export SUPABASE_DB_URL='postgresql://...'
BACKUP_DIR="$HOME/StudelyBackups" npm run db:backup
npm run db:export-seed
```

Files receive mode `0600`. `backups/` is gitignored. Store encrypted copy outside laptop. Retention: 7 daily, 4 weekly, 6 monthly snapshots.

## Restore drill

Never test first restore against production. Create disposable Supabase project, apply matching auth configuration separately, then:

```bash
export RESTORE_DB_URL='postgresql://...disposable-target...'
export SCHEMA_BACKUP='/secure/path/studely-...-schema.sql'
export DATA_BACKUP='/secure/path/studely-...-data.dump'
CONFIRM_RESTORE=RESTORE npm run db:restore
```

Verify:

- category/offer/attribute counts;
- score recomputation after one attribute transaction;
- anon sees published offers only;
- ordinary authenticated user cannot mutate offers or roles;
- staff can use admin editor;
- build succeeds against restored project;
- `/go/<slug>` redirects and writes one click.

Record date, target project, backup filenames, counts and result in operator log. Run drill quarterly and before large schema work.

## Production recovery

1. Stop editorial writes.
2. Identify last known-good timestamp.
3. Prefer Supabase PITR/platform restore for full auth consistency.
4. If platform restore unavailable, restore application dump into new project, recreate staff identities manually, then change environment variables only after validation.
5. Trigger clean Vercel deployment.
6. Test public pages, auth, admin, `/go`, RLS and verification write-back.
