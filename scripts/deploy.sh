#!/usr/bin/env bash
# Roll the stack forward on the VPS: get images, migrate the database, start.
#
#   bash scripts/deploy.sh                 # pull prebuilt images from the registry
#   bash scripts/deploy.sh --build         # build the images on this box instead
#   bash scripts/deploy.sh --seed          # also seed, if the database is empty
#   bash scripts/deploy.sh --external-db   # the database is not in this stack
#
# This exists because nothing in docker-compose.yml applies the migration on
# its own. `docker compose up -d` alone therefore starts the backend against
# whatever schema happens to be there, and it 500s the whole storefront on a
# missing SiteConfig row — a failure that looks like an application bug and
# doesn't mention migration.
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

# --external-db: this stack has no `db` service — the database lives somewhere
# else and is not this deploy's to manage. Set by scripts/live-stack.sh, which
# runs the production stack on a workstation against the LIVE database through
# an SSH tunnel.
#
# It suppresses exactly two steps, and the first one is the reason it exists:
# `prisma migrate deploy` below would otherwise apply pending migrations to
# whatever DATABASE_URL points at — which, for that local stack, is production.
# A developer testing an unreleased change would silently migrate the live
# database from their laptop, ahead of the code that needs it. The seeded-check
# goes too, since it shells into a `db` container that is not there.
#
# Never pass this on the VPS. The real deploy must migrate.
EXTERNAL_DB=false

for arg in "$@"; do
  case "$arg" in
    --build) MODE=build ;;
    --pull)  MODE=pull ;;
    --seed)  SEED=true ;;
    --external-db) EXTERNAL_DB=true ;;
    -h|--help) sed -n '2,7p' "${BASH_SOURCE[0]}" | sed 's/^# \?//'; exit 0 ;;
    *) echo "unknown option: $arg (try --help)" >&2; exit 2 ;;
  esac
done

if [ "$EXTERNAL_DB" = true ] && [ "$SEED" = true ]; then
  echo "--seed and --external-db together would seed demo data into a database this" >&2
  echo "stack does not own. Refusing." >&2
  exit 2
fi

log()  { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
fail() { printf '\n\033[1;31m==> %s\033[0m\n' "$*" >&2; exit 1; }

# An optional second compose file, layered over the base one.
#
# This exists so the deploy can be REHEARSED. Without it the only way to find
# out whether this script works was to run it on the live box, because the
# compose file was hardcoded and a second stack could not be brought up beside
# the real one. `deploy/rehearsal.override.yml` moves the published ports so a
# clean-box deploy can be run end to end against empty volumes:
#
#   COMPOSE_PROJECT_NAME=zuptech-rehearsal \
#   COMPOSE_EXTRA_FILE=deploy/rehearsal.override.yml \
#   bash scripts/deploy.sh --build --seed
#
# Unset in production, which is the point — the real deploy is unchanged.
COMPOSE_EXTRA_FILE="${COMPOSE_EXTRA_FILE:-}"
compose() {
  if [ -n "$COMPOSE_EXTRA_FILE" ]; then
    docker compose --env-file "$ENV_FILE" \
      -f "$APP_DIR/docker-compose.yml" -f "$APP_DIR/$COMPOSE_EXTRA_FILE" "$@"
  else
    docker compose --env-file "$ENV_FILE" -f "$APP_DIR/docker-compose.yml" "$@"
  fi
}

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
# committed migrations and never prompts.
if [ "$EXTERNAL_DB" = true ]; then
  log "Skipping migration — --external-db (this stack does not own the database)"
else
  log "Migrating backend database (zuptech)"
  compose run --rm backend bunx --bun prisma migrate deploy
fi

# ---------- Start ----------
log "Starting services"
compose up -d --remove-orphans

# ---------- Bootstrap check ----------
# Migrations create the SiteConfig TABLE but not the single row the storefront
# reads with findUniqueOrThrow. A migrated-but-unseeded database therefore
# passes every check above and still 500s on every page, which is exactly the
# failure this script exists to make impossible to reach silently.
if [ "$EXTERNAL_DB" = true ]; then
  log "Skipping the seeded-check — --external-db (there is no db container here)"
  seeded=skip
else
log "Checking the database is seeded"

# Read the password out of the env file rather than sourcing it: `source`
# would choke on unquoted values like `MAIL_FROM=ZUP TECH <no-reply@…>`.
pg_pass="$(sed -n 's/^ZUPTECH_DB_PASSWORD=//p' "$ENV_FILE" | head -1 | tr -d '\r')"
seeded=$(compose exec -T -e PGPASSWORD="$pg_pass" db \
  psql -U zuptech -d zuptech -tAc 'SELECT count(*) FROM "SiteConfig" WHERE id = 1' 2>/dev/null || echo "?")
fi

if [ "$seeded" = "skip" ]; then
  :
elif [ "$seeded" = "1" ]; then
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

# Both storefront containers, not just one.
#
# This step used to gate on the backend alone, which meant a storefront that
# could not serve a single page still counted as a successful deploy — and the
# storefront is where the last outage actually was. Each replica is checked on
# its own port rather than through nginx, because nginx will happily mask a
# dead container by sending everything to its sibling: the point here is to
# notice that half the capacity is missing, not just that the site answers.
log "Waiting for both storefront containers to serve"
for svc in frontend frontend2; do
  up=false
  for _ in $(seq 1 30); do
    if compose exec -T "$svc" \
         node -e "fetch('http://127.0.0.1:3001/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" \
         >/dev/null 2>&1; then
      up=true
      break
    fi
    sleep 4
  done
  if [ "$up" = true ]; then
    echo "    $svc serving"
  else
    echo "    $svc did not serve — recent logs:" >&2
    compose logs --tail=80 "$svc" >&2
    exit 1
  fi
done

# And the only container the public can actually reach.
#
# Every check above passed on a box where nginx was in a restart loop, and this
# script still printed "Deployed." — the app was perfectly healthy on an
# internal network nobody outside could get to. nginx exits at startup if the
# certificate is missing or the rendered config is invalid, which are the two
# most likely things to be wrong right after a deploy, so a green deploy that
# never looks at it is green about the wrong thing.
#
# Certificates are obtained before the first deploy (DEPLOYMENT.md §4), so by
# the time this runs nginx has everything it needs and staying down is a fault.
log "Checking the reverse proxy is up"
nginx_up=false
for _ in $(seq 1 15); do
  if [ "$(compose ps -q nginx | xargs -r docker inspect -f '{{.State.Running}}' 2>/dev/null)" = "true" ] \
     && compose exec -T nginx nginx -t >/dev/null 2>&1; then
    nginx_up=true
    break
  fi
  sleep 4
done
if [ "$nginx_up" = true ]; then
  echo "    nginx up, config valid"
else
  echo "    nginx is NOT serving — the site is unreachable from outside." >&2
  echo "    Most likely the certificate is missing (DEPLOYMENT.md §4) or the" >&2
  echo "    rendered config is invalid. Recent logs:" >&2
  compose logs --tail=40 nginx >&2
  exit 1
fi

# ---------- Cleanup ----------
# Without this the VPS disk fills up after a few dozen deploys.
log "Pruning old image layers"
docker image prune -f >/dev/null

log "Deployed."
