/**
 * Refuse schema-writing commands while DATABASE_URL points at the live tunnel.
 *
 *   bun run scripts/live-guard.ts "<what>"
 *
 * Wired into package.json as the `predb:migrate` / `predb:deploy` / `predb:seed`
 * hooks, so it fires on the commands a person actually types.
 *
 * The danger it exists for: `scripts/live-tunnel.sh` makes the live production
 * database reachable at 127.0.0.1:15432, and every muscle-memory command in
 * this repo is destructive against it. `migrate dev` offers to RESET the
 * database. `db:seed` writes demo products and demo staff into a real
 * catalogue. Neither asks twice.
 *
 * The check keys on the port, because 15432 is used nowhere else: the tunnel
 * picks it precisely so "is this live?" is a substring test that a hostname
 * reading as local cannot fool.
 *
 * IT LIVES IN backend/, IN TYPESCRIPT, ON PURPOSE. It was a bash script at the
 * repo root, and `backend/Dockerfile` copies only `backend/` — so inside the
 * container the hook resolved to nothing, exited 127, and took the whole
 * `scripts/deploy.sh --seed` with it. A first deploy against an empty database
 * failed at the seed with a "command not found". A guard that breaks the
 * deploy it is meant to protect is worse than no guard, so it now ships in the
 * image and depends on nothing but bun.
 *
 * This is a seatbelt, not a lock: `zuptech_ro` is the actual protection. In
 * --write mode this is the only thing between a habit and an outage.
 */

const what = process.argv[2] ?? "this command";

const url = process.env.DATABASE_URL ?? "";

if (url.includes(":15432")) {
  const red = "\x1b[1;31m";
  const off = "\x1b[0m";
  console.error(`
${red}╔════════════════════════════════════════════════════════════════════╗
║  REFUSED — DATABASE_URL points at the LIVE production database.    ║
╚════════════════════════════════════════════════════════════════════╝${off}

  Blocked: ${what}
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
`);
  process.exit(1);
}
