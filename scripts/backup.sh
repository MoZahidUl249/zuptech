#!/usr/bin/env bash
# Nightly backup: Postgres.
#
# Installed as a root cron entry by scripts/vps-bootstrap.sh. Run by hand with:
#   sudo APP_DIR=/opt/zuptech bash scripts/backup.sh
#
# Media (product photos/video, hero images, service images) lives on
# Cloudinary, not on this box — there is no local media volume to back up.
# Cloudinary's own backup/download tooling covers that half separately.
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/zuptech}"
OUT_DIR="${OUT_DIR:-/backup}"
KEEP_DAYS="${KEEP_DAYS:-14}"
ENV_FILE="${ENV_FILE:-$APP_DIR/.env.production}"

stamp="$(date +%F-%H%M)"
compose() { docker compose --env-file "$ENV_FILE" -f "$APP_DIR/docker-compose.yml" "$@"; }

if [ ! -f "$ENV_FILE" ]; then
  echo "[backup] $ENV_FILE not found — nothing to back up yet" >&2
  exit 1
fi

mkdir -p "$OUT_DIR"
echo "[backup] $(date -Is) starting"

# Read the superuser name out of the env file rather than sourcing it: cron
# has none of these in its environment, and `source`ing the file would choke on
# unquoted values like `MAIL_FROM=ZUP TECH <no-reply@…>`.
pg_user="$(sed -n 's/^POSTGRES_USER=//p' "$ENV_FILE" | head -1)"
pg_user="${pg_user:-postgres}"

# --- Postgres ---------------------------------------------------------------
# Written to a .part file and renamed only on success, so a backup interrupted
# halfway is never mistaken for a good one.
db_out="$OUT_DIR/pg-$stamp.sql.gz"
compose exec -T db pg_dumpall -U "$pg_user" | gzip > "$db_out.part"
mv "$db_out.part" "$db_out"
echo "[backup] database  -> $db_out ($(du -h "$db_out" | cut -f1))"

# --- Retention --------------------------------------------------------------
# Only ever deletes files this script created, matched by name — never a
# blanket sweep of the directory.
deleted=$(find "$OUT_DIR" -maxdepth 1 -type f \
  -name 'pg-*.sql.gz' \
  -mtime "+$KEEP_DAYS" -print -delete | wc -l)
echo "[backup] pruned $deleted file(s) older than $KEEP_DAYS days"

# Leftover .part files mean a previous run died mid-write.
find "$OUT_DIR" -maxdepth 1 -name '*.part' -mtime +1 -delete

echo "[backup] $(date -Is) done. Free space: $(df -h "$OUT_DIR" | awk 'NR==2{print $4}')"
echo "[backup] REMINDER: these live on the same disk as the app. Copy them off-box."
