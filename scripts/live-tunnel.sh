#!/usr/bin/env bash
# A tunnel from this workstation to the LIVE production database.
#
#   bash scripts/live-tunnel.sh up          # read-only  (zuptech_ro)
#   bash scripts/live-tunnel.sh up --write  # read-write (zuptech)  — takes a backup first
#   bash scripts/live-tunnel.sh status
#   bash scripts/live-tunnel.sh down
#   bash scripts/live-tunnel.sh psql        # a shell on the live database, in the current mode
#
# Why this exists: docker-compose.yml deliberately publishes no host port for
# `db` — nginx is the single ingress and there is no way to reach Postgres from
# outside the VPS's docker network. That is the right production posture, and
# this script does not change it. It resolves the db container's address on the
# VPS and forwards to it over SSH, so nothing new is exposed on the public
# interface and no compose file is edited.
#
# The container IP is resolved on every `up` because it changes whenever the
# container is recreated — a hardcoded address works until the next deploy and
# then fails in a way that looks like the database is down.
#
# READ MODE IS THE DEFAULT AND IT CANNOT SIGN IN. Better Auth writes a Session
# row on every login, so under zuptech_ro the storefront browses fine while
# sign-in, checkout and the whole admin panel fail with a permission error.
# That is not a bug; it is the reason `--write` has to be asked for.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${LIVE_ENV_FILE:-$REPO/.env.live.local}"

# 15432, not 5432: this workstation already runs its own PostgreSQL on 5432,
# and the unusual number doubles as the marker scripts/live-guard.sh greps for
# in DATABASE_URL to recognise "this points at live".
PORT=15432
CONTAINER=zuptech-live-tunnel
IMAGE=zuptech/live-tunnel:local
BACKUP_DIR="$REPO/scratchpad/live-backups"

# A dedicated docker network the stack joins to reach the tunnel, where this
# container answers to the name `livedb`.
#
# The obvious design — publish the port and let the backend dial
# host.docker.internal — does not work, and fails in a way worth recording. A
# published port bound to 127.0.0.1 is reachable from the HOST only; a
# container resolving host.docker.internal gets the bridge gateway (172.17.0.1)
# and connects to nothing. The fix is not to publish on 0.0.0.0: that would put
# an open socket to the production database on every interface of the machine,
# including the LAN. A private network keeps it container-to-container.
#
# 127.0.0.1:$PORT is ALSO published, for psql and prisma runs from the host.
NETWORK=zuptech-livedb
ALIAS=livedb

bold()  { printf '\033[1m%s\033[0m\n' "$*"; }
log()   { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
warn()  { printf '\033[1;33m%s\033[0m\n' "$*" >&2; }
fail()  { printf '\n\033[1;31m==> %s\033[0m\n' "$*" >&2; exit 1; }

# ---------- Config ----------
load_env() {
  [ -f "$ENV_FILE" ] || fail "$ENV_FILE not found.
    Copy the template and fill it in:
      cp .env.live.local.example .env.live.local"

  # Read assignments rather than sourcing: `source` chokes on unquoted values
  # with spaces, the same reason scripts/deploy.sh and backup.sh read theirs
  # with sed.
  get() { sed -n "s/^$1=//p" "$ENV_FILE" | head -1 | tr -d '\r' | sed 's/^"//;s/"$//'; }

  VPS_HOST="$(get VPS_HOST)"
  VPS_USER="$(get VPS_USER)"
  VPS_APP_DIR="$(get VPS_APP_DIR)"
  VPS_APP_DIR="${VPS_APP_DIR:-\$HOME/zup/zuptech}"
  SSH_KEY="$(get VPS_SSH_KEY)"
  DB_RO_PASSWORD="$(get LIVE_DB_RO_PASSWORD)"
  DB_RW_PASSWORD="$(get LIVE_DB_RW_PASSWORD)"

  # Normalise the key to an absolute host path.
  #
  # The template invites a bare filename because that is what the CONTAINER
  # needs (~/.ssh is mounted at /root/.ssh). Passed to the host's ssh, though,
  # a bare name resolves against the current directory and silently misses.
  # ssh then only warns — "Identity file ... not accessible" — and carries on
  # to try the agent, so on a desktop with gnome-keyring everything appears to
  # work while actually depending on the keyring. On any machine without one
  # (a server, cron, CI, a plain tty) the same config fails to authenticate.
  # Resolve it here so both paths use the key that was configured.
  if [ -n "$SSH_KEY" ]; then
    # The "~/" pattern matches a LITERAL tilde, which is the point: a value read
    # out of the env file is never shell-expanded, so `VPS_SSH_KEY="~/.ssh/k"`
    # arrives here with the tilde intact and has to be expanded by hand.
    # shellcheck disable=SC2088
    case "$SSH_KEY" in
      /*)    ;;
      "~/"*) SSH_KEY="$HOME/${SSH_KEY#\~/}" ;;
      *)     SSH_KEY="$HOME/.ssh/$SSH_KEY" ;;
    esac
    [ -f "$SSH_KEY" ] || fail "VPS_SSH_KEY points at $SSH_KEY, which does not exist."
    case "$SSH_KEY" in
      "$HOME"/.ssh/*) ;;
      *) fail "VPS_SSH_KEY must live under ~/.ssh (got: $SSH_KEY).
    Only that directory is mounted into the tunnel container." ;;
    esac
  fi

  [ -n "$VPS_HOST" ] || fail "VPS_HOST is empty in $ENV_FILE"
  [ -n "$VPS_USER" ] || fail "VPS_USER is empty in $ENV_FILE"
}

ssh_vps() {
  if [ -n "${SSH_KEY:-}" ]; then
    ssh -i "$SSH_KEY" -o BatchMode=yes "$VPS_USER@$VPS_HOST" "$@"
  else
    ssh -o BatchMode=yes "$VPS_USER@$VPS_HOST" "$@"
  fi
}

# ---------- Discovery ----------
# The db container's address inside the VPS's docker network. Two hops, because
# the container name depends on the compose project name and must not be
# guessed: ask compose for the id, then ask docker for that id's IP.
resolve_db_ip() {
  local id ip
  id=$(ssh_vps "cd $VPS_APP_DIR && docker compose --env-file .env.production ps -q db" 2>/dev/null | tr -d '\r')
  [ -n "$id" ] || fail "no running 'db' container on $VPS_HOST (looked in $VPS_APP_DIR).
    Check the stack is up:  ssh $VPS_USER@$VPS_HOST 'cd $VPS_APP_DIR && docker compose ps'"

  ip=$(ssh_vps "docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' $id" | tr -d '\r')
  [ -n "$ip" ] || fail "could not resolve an IP for db container $id"
  echo "$ip"
}

# ---------- Backup ----------
# Taken BEFORE the tunnel opens in write mode, never after. This is the actual
# recovery path if something under test writes the wrong thing, so it has to
# exist before anything can possibly write.
pre_dump() {
  mkdir -p "$BACKUP_DIR"
  local out
  out="$BACKUP_DIR/live-$(date +%F-%H%M%S).sql.gz"

  log "Write mode — dumping the live database first"
  echo "    $out"
  # .part until it succeeds, so an interrupted dump is never mistaken for a
  # good one (same discipline as scripts/backup.sh).
  if ! ssh_vps "cd $VPS_APP_DIR && docker compose --env-file .env.production exec -T db \
        pg_dump -U zuptech -d zuptech" 2>/dev/null | gzip > "$out.part"; then
    rm -f "$out.part"
    fail "pre-write backup failed — refusing to open a read-write tunnel without one"
  fi
  mv "$out.part" "$out"

  local size
  size=$(du -h "$out" | cut -f1)
  [ -s "$out" ] || fail "pre-write backup is empty — refusing to open a read-write tunnel"
  echo "    captured ($size)"
}

# ---------- Commands ----------
cmd_up() {
  local mode="read"
  [ "${1:-}" = "--write" ] && mode="write"

  load_env

  if docker ps -a --format '{{.Names}}' | grep -qx "$CONTAINER"; then
    fail "tunnel container '$CONTAINER' already exists — 'bash scripts/live-tunnel.sh down' first.
    (Refusing to replace it silently: you would not know which mode is open.)"
  fi
  if ss -lptnH "sport = :$PORT" 2>/dev/null | grep -q .; then
    fail "port $PORT is already in use by something else"
  fi

  # The tunnel itself only needs SSH — the database password is checked here,
  # before anything opens, purely so a missing one fails now rather than as an
  # authentication error from a container five steps later. scripts/live-stack.sh
  # is what actually reads it.
  if [ "$mode" = write ]; then
    [ -n "$DB_RW_PASSWORD" ] || fail "LIVE_DB_RW_PASSWORD is empty in $ENV_FILE.
    Write mode needs the zuptech owner password — the same value as
    ZUPTECH_DB_PASSWORD in the VPS's .env.production."
  else
    [ -n "$DB_RO_PASSWORD" ] || fail "LIVE_DB_RO_PASSWORD is empty in $ENV_FILE.
    Create the role once on the VPS — see deploy/live-readonly-role.sql"
  fi

  log "Building the tunnel image"
  docker build -q -f "$REPO/deploy/live-tunnel.Dockerfile" -t "$IMAGE" "$REPO/deploy" >/dev/null

  log "Resolving the live db container"
  local db_ip
  db_ip="$(resolve_db_ip)"
  echo "    $db_ip:5432 on $VPS_HOST"

  [ "$mode" = write ] && pre_dump

  log "Opening the tunnel"
  # An array, not an unquoted ${VAR:+...} expansion: the latter word-splits on
  # whitespace, so a key path containing a space would silently become two
  # arguments and ssh would fail with something unrelated to the real cause.
  #
  # load_env has already resolved SSH_KEY to an absolute path under ~/.ssh and
  # checked it exists, so this only has to remap the directory: ~/.ssh on the
  # host is /root/.ssh in the container.
  local key_args=()
  [ -n "${SSH_KEY:-}" ] && key_args=(-i "/root/.ssh/${SSH_KEY#"$HOME"/.ssh/}")

  # Created here rather than by compose, because the tunnel comes up before the
  # stack does and the stack declares this network `external`. Left behind by
  # `down` on purpose: an empty network costs nothing, and removing it would
  # break `live-stack.sh down` on a stack whose tunnel is already closed.
  docker network inspect "$NETWORK" >/dev/null 2>&1 || docker network create "$NETWORK" >/dev/null

  # 0.0.0.0 inside the container so both paths reach it: the private network by
  # the alias `livedb`, and the host through the published port — which stays
  # pinned to 127.0.0.1 so it is not on any real interface.
  docker run -d \
    --name "$CONTAINER" \
    --label "zuptech.live-tunnel.mode=$mode" \
    --restart no \
    --network "$NETWORK" \
    --network-alias "$ALIAS" \
    -p "127.0.0.1:$PORT:$PORT" \
    -v "$HOME/.ssh:/root/.ssh:ro" \
    "$IMAGE" \
    -L "0.0.0.0:$PORT:$db_ip:5432" \
    ${key_args[@]+"${key_args[@]}"} \
    "$VPS_USER@$VPS_HOST" >/dev/null

  # Wait for the forward rather than assuming it. ssh exits non-zero on a bad
  # host key or a refused forward, and the container dies — catching that here
  # turns a confusing Prisma error later into a clear message now.
  local ready=false
  for _ in $(seq 1 15); do
    if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
      echo "--- tunnel container exited ---" >&2
      docker logs "$CONTAINER" 2>&1 | tail -20 >&2
      docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
      fail "the tunnel could not connect.
    If this says 'Host key verification failed', ssh in by hand once to accept it:
      ssh $VPS_USER@$VPS_HOST"
    fi
    if (exec 3<>/dev/tcp/127.0.0.1/$PORT) 2>/dev/null; then ready=true; break; fi
    sleep 1
  done
  [ "$ready" = true ] || fail "port $PORT never accepted a connection"

  local user
  [ "$mode" = write ] && user=zuptech || user=zuptech_ro

  echo
  if [ "$mode" = write ]; then
    warn "┌──────────────────────────────────────────────────────────────┐"
    warn "│  READ-WRITE TUNNEL OPEN ON THE LIVE PRODUCTION DATABASE      │"
    warn "│  Every write from the local stack hits real customer data.   │"
    warn "│  Close it as soon as you are done:                           │"
    warn "│      bash scripts/live-tunnel.sh down                        │"
    warn "└──────────────────────────────────────────────────────────────┘"
  else
    bold "Read-only tunnel open (zuptech_ro)."
    echo "  Storefront reads work. Sign-in, checkout and admin will fail — by design."
    echo "  Need them?  bash scripts/live-tunnel.sh down && bash scripts/live-tunnel.sh up --write"
  fi
  echo
  echo "  127.0.0.1:$PORT  ->  live zuptech database as '$user'"
  echo
  echo "  127.0.0.1:$PORT from the host, '$ALIAS:$PORT' from the '$NETWORK' network."
  echo
  echo "  Bring the local production stack up:"
  echo "      bash scripts/live-stack.sh up"
}

cmd_down() {
  if docker ps -a --format '{{.Names}}' | grep -qx "$CONTAINER"; then
    docker rm -f "$CONTAINER" >/dev/null
    bold "Tunnel closed."
  else
    echo "No tunnel running."
  fi
}

cmd_status() {
  if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
    echo "tunnel: down"
    return 0
  fi
  local mode
  mode=$(docker inspect -f '{{index .Config.Labels "zuptech.live-tunnel.mode"}}' "$CONTAINER")
  echo "tunnel: up (${mode:-unknown} mode)"
  ss -lptnH "sport = :$PORT" 2>/dev/null | grep -q . \
    && echo "port:   127.0.0.1:$PORT listening" \
    || warn "port:   NOT listening — the container is up but the forward is not"
}

# A psql shell through the tunnel, using whichever role the tunnel was opened
# with. Runs in a container so no host psql version has to match the server.
cmd_psql() {
  load_env
  docker ps --format '{{.Names}}' | grep -qx "$CONTAINER" || fail "no tunnel — run 'up' first"
  local mode user password
  mode=$(docker inspect -f '{{index .Config.Labels "zuptech.live-tunnel.mode"}}' "$CONTAINER")
  if [ "$mode" = write ]; then user=zuptech; password="$DB_RW_PASSWORD";
  else user=zuptech_ro; password="$DB_RO_PASSWORD"; fi

  # -t only when there actually is a terminal. Hardcoding -it makes this fail
  # with "cannot attach stdin to a TTY-enabled container" the moment it is run
  # from a script, a CI step or an agent — i.e. exactly when a one-off query
  # like `... psql -tAc 'SELECT ...'` is most useful.
  local tty=()
  [ -t 0 ] && [ -t 1 ] && tty=(-t)

  # On the tunnel's own network, by the same alias the stack uses — so this
  # exercises the path the backend takes rather than a host-only shortcut.
  docker run --rm -i ${tty[@]+"${tty[@]}"} --network "$NETWORK" \
    -e PGPASSWORD="$password" postgres:16-alpine \
    psql -h "$ALIAS" -p "$PORT" -U "$user" -d zuptech "$@"
}

case "${1:-}" in
  up)     shift; cmd_up "$@" ;;
  down)   cmd_down ;;
  status) cmd_status ;;
  psql)   shift; cmd_psql "$@" ;;
  -h|--help|"") sed -n '2,10p' "${BASH_SOURCE[0]}" | sed 's/^# \?//' ;;
  *) fail "unknown command: $1 (try --help)" ;;
esac
