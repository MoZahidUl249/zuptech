#!/usr/bin/env bash
# Nightly backup: Postgres (both databases) + the uploaded media volume.
#
# Installed as a root cron entry by scripts/vps-bootstrap.sh. Run by hand with:
#   sudo APP_DIR=/opt/zuptech bash scripts/backup.sh
#
# BOTH artefacts are required for a full restore. A pg_dump alone restores the
# catalog with every product photo pointing at a file that no longer exists;
# the media tarball alone is a pile of unreferenced blobs. Keep them together.
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
# pg_dumpall captures both databases and the roles they depend on. Written to a
# .part file and renamed only on success, so a backup interrupted halfway is
# never mistaken for a good one.
db_out="$OUT_DIR/pg-$stamp.sql.gz"
compose exec -T db pg_dumpall -U "$pg_user" | gzip > "$db_out.part"
mv "$db_out.part" "$db_out"
echo "[backup] database  -> $db_out ($(du -h "$db_out" | cut -f1))"

# --- Media volume -----------------------------------------------------------
# Read straight from the named volume rather than through the storage service,
# so this works even when that container is unhealthy.
media_out="$OUT_DIR/media-$stamp.tar.gz"
docker run --rm \
  -v zuptech_media_data:/data:ro \
  -v "$OUT_DIR":/out \
  alpine tar czf "/out/$(basename "$media_out").part" -C /data .
mv "$media_out.part" "$media_out"
echo "[backup] media     -> $media_out ($(du -h "$media_out" | cut -f1))"

# --- Retention --------------------------------------------------------------
# Only ever deletes files this script created, matched by name — never a
# blanket sweep of the directory.
deleted=$(find "$OUT_DIR" -maxdepth 1 -type f \
  \( -name 'pg-*.sql.gz' -o -name 'media-*.tar.gz' \) \
  -mtime "+$KEEP_DAYS" -print -delete | wc -l)
echo "[backup] pruned $deleted file(s) older than $KEEP_DAYS days"

# Leftover .part files mean a previous run died mid-write.
find "$OUT_DIR" -maxdepth 1 -name '*.part' -mtime +1 -delete

echo "[backup] $(date -Is) done. Free space: $(df -h "$OUT_DIR" | awk 'NR==2{print $4}')"
echo "[backup] REMINDER: these live on the same disk as the app. Copy them off-box."
