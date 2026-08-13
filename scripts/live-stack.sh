#!/usr/bin/env bash
# Run the production stack on this workstation, against the LIVE database.
#
#   bash scripts/live-tunnel.sh up      # open the tunnel first
#   bash scripts/live-stack.sh up       # build + start + health-check
#   bash scripts/live-stack.sh logs backend
#   bash scripts/live-stack.sh down
#
# This is a thin wrapper, on purpose. The actual rollout logic stays in
# scripts/deploy.sh — the same script the GitHub workflow SSHes in and runs —
# so the thing tested here and the thing that ships cannot drift apart. What
# the wrapper adds is the three settings that are easy to get wrong and
# dangerous to get wrong:
#
#   --external-db   never migrate. Without it deploy.sh runs `prisma migrate
#                   deploy` against DATABASE_URL, which here is production.
#   --build         never pull. NEXT_PUBLIC_* is baked into the frontend bundle
#                   at image build time, so a pulled image points next/image and
#                   the site URL at the real domain and the local run is a lie.
#   LIVE_DATABASE_URL  composed from whichever mode the tunnel is actually in,
#                   rather than typed by hand and left stale on the wrong role.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LIVE_ENV="${LIVE_ENV_FILE:-$REPO/.env.live.local}"
STACK_ENV="${STACK_ENV_FILE:-$REPO/.env.production.local}"
TUNNEL=zuptech-live-tunnel
PROJECT=zuptech-live
PORT=15432
# Must match scripts/live-tunnel.sh and the `networks:` block in
# deploy/live-db.override.yml — the backend reaches the tunnel by this alias on
# this network, not through a published host port.
ALIAS=livedb
NETWORK=zuptech-livedb

log()  { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m%s\033[0m\n' "$*" >&2; }
fail() { printf '\n\033[1;31m==> %s\033[0m\n' "$*" >&2; exit 1; }

compose() {
  COMPOSE_PROJECT_NAME="$PROJECT" docker compose \
    --env-file "$STACK_ENV" \
    -f "$REPO/docker-compose.yml" \
    -f "$REPO/deploy/live-db.override.yml" "$@"
}

# The role follows the tunnel, never a hand-typed value: opening a read-only
# tunnel and connecting as `zuptech` would fail with an authentication error
# that says nothing about the real mistake.
resolve_db_url() {
  [ -f "$LIVE_ENV" ] || fail "$LIVE_ENV not found — cp .env.live.local.example .env.live.local"
  docker ps --format '{{.Names}}' | grep -qx "$TUNNEL" \
    || fail "no tunnel to the live database.
    bash scripts/live-tunnel.sh up          # read-only
    bash scripts/live-tunnel.sh up --write  # read-write"

  # The compose files declare this network `external`, so a missing one fails
  # with compose's own opaque error. Catch it here where the fix is obvious.
  docker network inspect "$NETWORK" >/dev/null 2>&1 \
    || fail "docker network '$NETWORK' is missing — scripts/live-tunnel.sh creates it.
    Close and reopen the tunnel:  bash scripts/live-tunnel.sh down && bash scripts/live-tunnel.sh up"

  local mode user password
  mode=$(docker inspect -f '{{index .Config.Labels "zuptech.live-tunnel.mode"}}' "$TUNNEL")
  get() { sed -n "s/^$1=//p" "$LIVE_ENV" | head -1 | tr -d '\r' | sed 's/^"//;s/"$//'; }

  if [ "$mode" = write ]; then
    user=zuptech;    password="$(get LIVE_DB_RW_PASSWORD)"
    warn "  tunnel is in WRITE mode — this stack can modify real customer data"
  else
    user=zuptech_ro; password="$(get LIVE_DB_RO_PASSWORD)"
    echo "  tunnel is in read-only mode — sign-in, checkout and admin will fail by design"
  fi
  [ -n "$password" ] || fail "no password for '$user' in $LIVE_ENV"

  export LIVE_DATABASE_URL="postgres://$user:$password@$ALIAS:$PORT/zuptech"
}

cmd_up() {
  [ -f "$STACK_ENV" ] || fail "$STACK_ENV not found — cp .env.production.local.example .env.production.local"
  log "Resolving the live database connection"
  resolve_db_url

  # A local TLS certificate at the paths certbot would use, so nginx runs its
  # real template unmodified rather than a second local-only code path.
  if ! docker volume inspect "${PROJECT}_certbot_conf" >/dev/null 2>&1; then
    log "Installing a self-signed certificate for the local domains"
    bash "$REPO/scripts/docker-local-tls.sh" zuptech.local api.zuptech.local "${PROJECT}_certbot_conf"
  fi

  log "Handing off to scripts/deploy.sh (the same script production uses)"
  COMPOSE_PROJECT_NAME="$PROJECT" \
  COMPOSE_EXTRA_FILE=deploy/live-db.override.yml \
  ENV_FILE="$STACK_ENV" \
  LIVE_DATABASE_URL="$LIVE_DATABASE_URL" \
    bash "$REPO/scripts/deploy.sh" --build --external-db

  # Reload nginx so it re-resolves the upstreams.
  #
  # Open-source nginx resolves an upstream hostname ONCE at startup and holds
  # that address for the life of the process (see the note on `frontend` in
  # docker-compose.yml — the `resolve` parameter is NGINX Plus only). `up -d`
  # recreates backend and the storefronts when their config changes but leaves
  # nginx alone, so nginx keeps pointing at container IPs that no longer exist
  # and every request 502s.
  #
  # This bites on every mode switch here, because changing DATABASE_URL between
  # read and write is exactly the kind of config change that recreates the
  # backend. Observed directly: a valid login returned 502 from nginx while the
  # session row it created was already in the database.
  log "Reloading nginx so it re-resolves the new container IPs"
  compose exec -T nginx nginx -s reload >/dev/null 2>&1 || true

  cat <<EOF

  Storefront   https://zuptech.local:8444
  API          https://api.zuptech.local:8444

  Add these to /etc/hosts once, if they are not there already:
      127.0.0.1  zuptech.local www.zuptech.local api.zuptech.local

  The certificate is self-signed, so a browser will warn. curl needs -k.

EOF
}

cmd_down() {
  # LIVE_DATABASE_URL is interpolated by the override even on `down`, so give
  # it something syntactically valid — nothing connects during a teardown.
  LIVE_DATABASE_URL="postgres://unused@127.0.0.1:1/none" compose down --remove-orphans
  # Only say the tunnel is open if it actually is — this runs in both states,
  # and an unconditional reminder trains you to ignore it.
  if docker ps --format '{{.Names}}' | grep -qx "$TUNNEL"; then
    printf '\033[1m%s\033[0m\n' "Local stack down. The tunnel to LIVE is still open — 'bash scripts/live-tunnel.sh down' closes it."
  else
    printf '\033[1m%s\033[0m\n' "Local stack down. No tunnel open."
  fi
}

cmd_logs() {
  LIVE_DATABASE_URL="postgres://unused@127.0.0.1:1/none" compose logs --since=5m "$@"
}

cmd_ps() {
  LIVE_DATABASE_URL="postgres://unused@127.0.0.1:1/none" compose ps
}

case "${1:-}" in
  up)   cmd_up ;;
  down) cmd_down ;;
  logs) shift; cmd_logs "$@" ;;
  ps)   cmd_ps ;;
  -h|--help|"") sed -n '2,8p' "${BASH_SOURCE[0]}" | sed 's/^# \?//' ;;
  *) fail "unknown command: $1 (try --help)" ;;
esac
