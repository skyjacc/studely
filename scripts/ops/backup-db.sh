#!/usr/bin/env bash
set -euo pipefail

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "pg_dump is required (PostgreSQL client tools)." >&2
  exit 1
fi

DB_URL="${SUPABASE_DB_URL:-}"
if [[ -z "$DB_URL" ]]; then
  echo "SUPABASE_DB_URL is required. Use the direct or session-pooler Postgres connection string, not the public API URL." >&2
  exit 1
fi

OUT_DIR="${BACKUP_DIR:-backups}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$OUT_DIR"
SCHEMA_FILE="$OUT_DIR/studely-${STAMP}-schema.sql"
DATA_FILE="$OUT_DIR/studely-${STAMP}-data.dump"

# Schema includes public/private functions, policies and migrations' result. Auth
# schema remains owned by Supabase and is not restored by this application runbook.
pg_dump "$DB_URL" \
  --schema-only \
  --no-owner \
  --no-privileges \
  --schema=public \
  --schema=private \
  --file="$SCHEMA_FILE"

# Custom-format content backup. Dependency ordering is handled by pg_restore.
pg_dump "$DB_URL" \
  --format=custom \
  --data-only \
  --no-owner \
  --no-privileges \
  --schema=public \
  --exclude-table=public.profiles \
  --file="$DATA_FILE"

chmod 600 "$SCHEMA_FILE" "$DATA_FILE"
printf 'Created:\n  %s\n  %s\n' "$SCHEMA_FILE" "$DATA_FILE"
printf 'Auth users and public.profiles are excluded; preserve them through Supabase platform backups.\n'
