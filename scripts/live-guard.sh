#!/usr/bin/env bash
# Refuse schema-writing commands while DATABASE_URL points at the live tunnel.
#
#   bash scripts/live-guard.sh <what>     # e.g. "prisma migrate dev"
#
# Wired into backend/package.json as the `predb:migrate` / `predb:seed` /
# `predb:studio` hooks, so it fires on the commands a person actually types
# rather than only when they remember to think about it.
#
# The danger it exists for: scripts/live-tunnel.sh makes the live production
# database reachable at 127.0.0.1:15432, and every muscle-memory command in
# this repo — `bun run db:migrate`, `bun run db:seed` — is destructive against
# it. `migrate dev` will offer to RESET the database. `db:seed` writes demo
# products and demo staff into a real catalogue. Neither asks a second time.
#
# The check keys on the port, because 15432 is used nowhere else: the tunnel
# picks it precisely so "is this live?" is a substring test that cannot be
# fooled by a hostname that happens to read as local.
#
# This is a seatbelt, not a lock. `zuptech_ro` is the actual protection; in
# write mode this is the only thing standing between a habit and an outage.
set -euo pipefail

WHAT="${1:-this command}"

# Prefer an explicitly exported DATABASE_URL, fall back to backend/.env — which
# is what prisma.config.ts itself reads, so the guard sees the same value the
# CLI is about to use.
url="${DATABASE_URL:-}"
if [ -z "$url" ]; then
  env_file="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/backend/.env"
  [ -f "$env_file" ] && url="$(sed -n 's/^DATABASE_URL=//p' "$env_file" | head -1 | tr -d '\r"')"
fi

case "$url" in
  *:15432*)
    cat >&2 <<EOF

$(printf '\033[1;31m')╔════════════════════════════════════════════════════════════════════╗
║  REFUSED — DATABASE_URL points at the LIVE production database.    ║
╚════════════════════════════════════════════════════════════════════╝$(printf '\033[0m')

  Blocked: $WHAT
  Target:  port 15432 — the scripts/live-tunnel.sh forward to live.

  This would change the schema or the data of the real site. Even the
  read-only tunnel would only turn it into a confusing permission error;
  in --write mode it would simply succeed.

  Schema work belongs on a throwaway database, not on live. Use the
  rehearsal stack, which exists for exactly this:

      COMPOSE_PROJECT_NAME=zuptech-rehearsal \\
      COMPOSE_EXTRA_FILE=deploy/rehearsal.override.yml \\
      bash scripts/deploy.sh --build --seed

  Once the migration is committed and CI is green, live gets it through
  the normal rollout — scripts/deploy.sh runs \`prisma migrate deploy\`
  on the VPS, before the new code serves.

  If you are certain and this is a deliberate operation on live, close
  the tunnel first and do it on the VPS where it is visible in the logs.

EOF
    exit 1
    ;;
esac

exit 0
