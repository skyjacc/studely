#!/usr/bin/env bash
set -euo pipefail

if [[ "${CONFIRM_RESTORE:-}" != "RESTORE" ]]; then
  echo "Refusing destructive restore. Set CONFIRM_RESTORE=RESTORE after verifying target is disposable." >&2
  exit 1
fi
if [[ -z "${RESTORE_DB_URL:-}" ]]; then
  echo "RESTORE_DB_URL is required. Never default restore target to production." >&2
  exit 1
fi
if [[ -z "${SCHEMA_BACKUP:-}" || -z "${DATA_BACKUP:-}" ]]; then
  echo "SCHEMA_BACKUP and DATA_BACKUP are required." >&2
  exit 1
fi
if [[ ! -f "$SCHEMA_BACKUP" || ! -f "$DATA_BACKUP" ]]; then
  echo "Backup file missing." >&2
  exit 1
fi
for bin in psql pg_restore; do
  command -v "$bin" >/dev/null 2>&1 || { echo "$bin is required." >&2; exit 1; }
done

case "$RESTORE_DB_URL" in
  *localhost*|*127.0.0.1*|*pooler.supabase.com*|*.supabase.co*) ;;
  *)
    echo "Target URL does not look like local/Supabase Postgres. Refusing." >&2
    exit 1
    ;;
esac

# The allowlist above accepts any Supabase host — which is exactly how production
# is reached, so on its own it does not honour "never default restore target to
# production". Refuse the production project ref outright; restoring over live
# data has to be a deliberate act somewhere other than this script.
PRODUCTION_DB_REF="${PRODUCTION_DB_REF:-myehxcjcdjxjysoeiynq}"
if [[ -n "$PRODUCTION_DB_REF" && "$RESTORE_DB_URL" == *"$PRODUCTION_DB_REF"* ]]; then
  echo "RESTORE_DB_URL points at the production project ($PRODUCTION_DB_REF). Refusing." >&2
  echo "Restore into a disposable project or local Postgres instead." >&2
  exit 1
fi

psql "$RESTORE_DB_URL" -v ON_ERROR_STOP=1 -f "$SCHEMA_BACKUP"

# The data backup deliberately omits public.profiles (it mirrors auth.users,
# which Supabase restores at the platform level). Every restored table that
# references profiles — offers.created_by, verifications.checked_by,
# submissions.*, comments.* — would therefore fail its FK check against an empty
# profiles table, and --exit-on-error would abort the whole restore at the first
# COPY: the recovery fails precisely when it is needed. Stream the dump through a
# single psql session with referential triggers off so the data lands, then
# reconcile the dangling references below.
{
  echo "set session_replication_role = replica;"
  pg_restore --data-only --no-owner --no-privileges --file=- "$DATA_BACKUP"
  echo "set session_replication_role = default;"
} | psql "$RESTORE_DB_URL" -v ON_ERROR_STOP=1

# Reconcile references to the profiles this backup intentionally left out, so the
# restored database is self-consistent rather than quietly holding broken FKs.
# Nullable references follow their own "on delete set null" semantics; comments
# carry a NOT NULL author and follow "on delete cascade".
psql "$RESTORE_DB_URL" -v ON_ERROR_STOP=1 <<'SQL'
update public.offers        set created_by   = null where created_by   is not null and not exists (select 1 from public.profiles p where p.id = created_by);
update public.verifications set checked_by   = null where checked_by   is not null and not exists (select 1 from public.profiles p where p.id = checked_by);
update public.submissions   set submitted_by = null where submitted_by is not null and not exists (select 1 from public.profiles p where p.id = submitted_by);
update public.submissions   set reviewed_by  = null where reviewed_by  is not null and not exists (select 1 from public.profiles p where p.id = reviewed_by);
update public.comments      set moderated_by = null where moderated_by is not null and not exists (select 1 from public.profiles p where p.id = moderated_by);
delete from public.comments where not exists (select 1 from public.profiles p where p.id = author_id);
SQL

psql "$RESTORE_DB_URL" -v ON_ERROR_STOP=1 <<'SQL'
select 'categories' as table_name, count(*) from public.categories
union all select 'offers', count(*) from public.offers
union all select 'offer_attributes', count(*) from public.offer_attributes
union all select 'verifications', count(*) from public.verifications
union all select 'link_checks', count(*) from public.link_checks
union all select 'offer_clicks', count(*) from public.offer_clicks;
SQL
