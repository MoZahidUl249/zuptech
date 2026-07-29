#!/usr/bin/env bash
# Roll the stack forward on the VPS: get images, migrate BOTH databases, start.
#
#   bash scripts/deploy.sh            # pull prebuilt images from the registry
#   bash scripts/deploy.sh --build    # build the images on this box instead
#   bash scripts/deploy.sh --seed     # also seed, if the database is empty
#
# This exists because the two databases have separate migration histories and
# nothing in docker-compose.yml applies either one. `docker compose up -d` on
# its own therefore starts services against whatever schema happens to be
# there: the storage service answers every request with `relation "media" does
# not exist`, and the backend 500s the whole storefront on a missing SiteConfig
# row. Both failures look like application bugs and neither mentions migration.
#
# .github/workflows/deploy.yml calls this same script, so the automated and the
# by-hand path cannot drift apart.
#
# Idempotent: both migration runners skip what they have already applied, so
# re-running is a no-op against an up-to-date box.
set -euo pipefail

# Default to the checkout this script lives in, so it works from /opt/zuptech,
# ~/zup/zuptech or anywhere else without editing anything.
APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
ENV_FILE="${ENV_FILE:-$APP_DIR/.env.production}"

MODE=pull
SEED=false
for arg in "$@"; do
  case "$arg" in
    --build) MODE=build ;;
    --pull)  MODE=pull ;;
    --seed)  SEED=true ;;
    -h|--help) sed -n '2,6p' "${BASH_SOURCE[0]}" | sed 's/^# \?//'; exit 0 ;;
    *) echo "unknown option: $arg (try --help)" >&2; exit 2 ;;
  esac
done

log()  { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
fail() { printf '\n\033[1;31m==> %s\033[0m\n' "$*" >&2; exit 1; }

compose() { docker compose --env-file "$ENV_FILE" -f "$APP_DIR/docker-compose.yml" "$@"; }

# ---------- Preflight ----------
[ -f "$ENV_FILE" ] || fail "$ENV_FILE not found — copy .env.production.example and fill it in (DEPLOYMENT.md §3)"

# ---------- Images ----------
if [ "$MODE" = build ]; then
  log "Building images on this host"
  compose build
else
  log "Pulling images from the registry"
  compose pull
fi

# ---------- Migrations ----------
# Before the new code serves, never after. `prisma migrate deploy` only applies
# committed migrations and never prompts; the storage runner tracks what it has
# applied in its own schema_migrations table.
log "Migrating backend database (zuptech)"
compose run --rm backend bunx --bun prisma migrate deploy

log "Migrating storage database (media_storage)"
compose run --rm storage bun run migrate

# ---------- Start ----------
log "Starting services"
compose up -d --remove-orphans

# ---------- Bootstrap check ----------
# Migrations create the SiteConfig TABLE but not the single row the storefront
# reads with findUniqueOrThrow. A migrated-but-unseeded database therefore
# passes every check above and still 500s on every page, which is exactly the
# failure this script exists to make impossible to reach silently.
log "Checking the database is seeded"

# Read the password out of the env file rather than sourcing it: `source`
# would choke on unquoted values like `MAIL_FROM=ZUP TECH <no-reply@…>`.
pg_pass="$(sed -n 's/^ZUPTECH_DB_PASSWORD=//p' "$ENV_FILE" | head -1 | tr -d '\r')"
seeded=$(compose exec -T -e PGPASSWORD="$pg_pass" db \
  psql -U zuptech -d zuptech -tAc 'SELECT count(*) FROM "SiteConfig" WHERE id = 1' 2>/dev/null || echo "?")

if [ "$seeded" = "1" ]; then
  echo "    SiteConfig row present"
elif [ "$seeded" = "?" ]; then
  echo "    could not query the database — check by hand:"
  echo "      docker compose --env-file .env.production exec db \\"
  echo "        psql -U zuptech -d zuptech -c 'SELECT id FROM \"SiteConfig\"'"
elif [ "$SEED" = true ]; then
  log "Seeding (first run on this database)"
  echo "    NOTE: staff passwords are random under NODE_ENV=production and are"
  echo "    printed ONCE, below. Copy them out now — they are not recoverable."
  compose run --rm backend bun run db:seed
else
  fail "Database has no SiteConfig row — the storefront will 500 on every page.
    Seed it once. Staff passwords are random under NODE_ENV=production and are
    printed ONCE, so capture that output:

      cd $APP_DIR && bash scripts/deploy.sh --seed"
fi

# ---------- Health ----------
log "Waiting for the backend to report healthy"
healthy=false
for _ in $(seq 1 30); do
  if compose exec -T backend \
       bun -e "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" \
       >/dev/null 2>&1; then
    healthy=true
    break
  fi
  sleep 4
done
if [ "$healthy" = true ]; then
  echo "    backend healthy"
else
  echo "    backend did not become healthy — recent logs:" >&2
  compose logs --tail=80 backend >&2
  exit 1
fi

# ---------- Cleanup ----------
# Without this the VPS disk fills up after a few dozen deploys.
log "Pruning old image layers"
docker image prune -f >/dev/null

log "Deployed."
