# Deploying ZUP TECH (Docker + GitHub Actions + nginx)

Single VPS, two app services behind nginx, images built by CI and pulled by
the server. Media (product photos/video, hero images, service images) lives
on Cloudinary, not on this box. Verified end to end: both images build, the
stack boots healthy, the database initialises, migrations apply and the
storefront serves.

```
             ┌───────── nginx (:80/:443, the only public ports) ─────────┐
 <domain> ───┤ frontend:3001  ┐
             │ frontend2:3001 ┘ api.<domain> → backend:3000
             └──────────────────────────────────────────────────────────┘
                         backend ──► postgres (zuptech)
                         backend ──► Cloudinary (media)
```

The storefront runs as **two** containers, both in nginx's `storefront`
upstream, so restarting or losing one is invisible to visitors — measured at
30,687 requests with zero errors across a deliberate kill and restart of one of
them. They are separate compose services rather than replicas of one because
open-source nginx resolves an upstream hostname once at startup; see the comment
in `docker-compose.yml`. Both run the same image, which is what keeps their
Server Actions encryption keys in step.

Throughout, `<domain>` is the site's domain (e.g. `example.com`). It appears in
exactly three places: `.env.production` on the VPS, two GitHub repository
Variables, and the certificate. Nothing else hardcodes it — the nginx config is
a template rendered at container start.

## 0. Prerequisites

- A VPS (2 GB RAM minimum — the Next.js build runs in CI, not here).
- Three DNS A records → the VPS IP: `<domain>`, `www.<domain>`,
  `api.<domain>`. **Do this first**; certificate issuance fails otherwise,
  and DNS takes time to propagate.
- A Cloudinary account (cloud name + API key/secret from the Console) — see
  `backend/.env.example`.
- A GitHub repo with the code pushed to `main`.

Before the first push, confirm no secrets are staged — `backend/.env` holds
live credentials:

```bash
git status --porcelain | grep -E '\.env$|\.env\.' && echo "STOP — secrets staged"
```

(The root `.gitignore` already excludes `.env`, `node_modules/`, `.next/`
and `backend/src/generated/`.)

## 1. Prepare the VPS

One script does the whole server-side setup — Docker, a `deploy` user, the
firewall, swap, Docker log rotation and a nightly backup cron:

```bash
ssh root@VPS 'bash -s' < scripts/vps-bootstrap.sh
```

It is idempotent, so re-running it is safe. It deliberately stops short of
anything needing a secret or a human decision: the repo clone, `.env.production`
and the certificates are the next three steps.

## 2. Give the VPS read access to the repo (private repos)

The deploy step runs `git reset --hard origin/main` on the server — the VPS
needs the repo itself, because compose and the nginx template are read from the
checkout even though it runs prebuilt images. For a private repo that fetch
needs credentials.

Use a **deploy key**: unlike a personal access token it is scoped to this one
repository, and read-only. As the `deploy` user:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/github_deploy -N "" -C "$(hostname)-deploy"
ssh-keyscan github.com >> ~/.ssh/known_hosts
cat >> ~/.ssh/config <<'EOF'
Host github.com
  IdentityFile ~/.ssh/github_deploy
  IdentitiesOnly yes
EOF
chmod 600 ~/.ssh/config
cat ~/.ssh/github_deploy.pub
```

Paste that public key into **repo → Settings → Deploy keys → Add deploy key**,
leaving *Allow write access* **unchecked**. Then clone over SSH (not HTTPS):

```bash
git clone git@github.com:OWNER/REPO.git /opt/zuptech
cd /opt/zuptech && git status     # proves the key works
```

`/opt/zuptech` is this guide's path, not a requirement — `scripts/deploy.sh`
resolves its own checkout, and the deploy workflow takes `APP_DIR` (falling
back to `~/zup/zuptech`, where the live box actually keeps it). If the clone
lives somewhere else, set `APP_DIR` rather than moving it: the workflow used to
hardcode `/opt/zuptech` and every rollout failed on its first line, on a box
whose checkout was one directory over.

Note there are **two different keys** in this setup, and mixing them up is the
usual cause of a failed first deploy:

| Key | Direction | Lives in |
|---|---|---|
| deploy key | VPS → GitHub (pull code) | VPS `~/.ssh/github_deploy`, public half in repo Deploy keys |
| `VPS_SSH_KEY` | GitHub → VPS (run the rollout) | GitHub Actions secret, public half in the VPS's `authorized_keys` |

## 3. Configure `.env.production`

```bash
cd /opt/zuptech
cp .env.production.example .env.production
chmod 600 .env.production
```

Fill it in. Generate each secret separately — never reuse one value for two
purposes:

```bash
openssl rand -hex 32   # BETTER_AUTH_SECRET
openssl rand -hex 24   # each of the DB passwords
```

Then set:

- `APP_DOMAIN`, `API_DOMAIN` — bare hostnames, no scheme
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` —
  from the Cloudinary Console; `CLOUDINARY_FOLDER_PREFIX=zuptech-prod` keeps
  this account's uploads separate from any dev/staging account sharing it
- `BETTER_AUTH_URL=https://api.<domain>` and `CORS_ORIGINS=https://<domain>`
- `REGISTRY=ghcr.io/OWNER/REPO` — **all lowercase**, matching the repo exactly.
  The workflow publishes to `ghcr.io/${{ github.repository }}`; anything else
  here makes `docker compose pull` fail on an image that was never pushed.
- the `SMTP_*` block — with `SMTP_HOST` empty, reset codes go to the container
  log instead of an inbox and nobody can recover a password

## 4. Certificates (once, before nginx can start on 443)

nginx crash-loops on a missing certificate, so issue one before the stack ever
comes up, using a throwaway standalone server:

```bash
cd /opt/zuptech
docker run --rm -p 80:80 \
  -v zuptech_certbot_conf:/etc/letsencrypt \
  certbot/certbot certonly --standalone \
  -d <domain> -d www.<domain> -d api.<domain> \
  --email you@example.com --agree-tos --no-eff-email
```

All three names go on **one** certificate, and every nginx server block points
at `live/${APP_DOMAIN}/`. The first `-d` determines that directory name, so it
must be `<domain>` — the same value as `APP_DOMAIN`.

Renewal is automatic afterwards: the `certbot` service renews every 12h and
nginx reloads on the same cycle.

## 5. GitHub configuration

**Secrets** (Settings → Secrets and variables → Actions → Secrets):

| Name | Value |
|---|---|
| `VPS_HOST` | server IP |
| `VPS_USER` | `deploy` |
| `VPS_SSH_KEY` | private key whose public half is in `deploy`'s `authorized_keys` |

**Variables** (same page → Variables). These are compiled into public
JavaScript, so they are variables, not secrets:

| Name | Value |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | `https://<domain>` |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | same value as `CLOUDINARY_CLOUD_NAME` |

Create an **Environment** called `production` (Settings → Environments). Leave
required reviewers empty for fully automatic deploys, or add yourself to make
every release pause for a click.

## 6. First deploy

Push to `main`, or run the *Deploy* workflow manually. The pipeline:

1. **CI** — typecheck both packages, lint, run backend tests.
2. **publish** — build and push both images to GHCR, tagged `latest` and
   the commit SHA.
3. **deploy** — SSH in, `git reset --hard origin/main`, then run
   `scripts/deploy.sh --pull`, which does the actual rollout.

Seed once, on the first deploy only. This is **not optional**: the storefront
reads its `SiteConfig` row with `findUniqueOrThrow`, so every page returns 500
against an empty database.

```bash
cd /opt/zuptech
bash scripts/deploy.sh --seed
```

The seed creates `arif`/`nusrat`/`rakib`. Under `NODE_ENV=production` each one
gets a **randomly generated password, printed once** in that command's output:

```
  staff: arif · password: zup-Xq7f2K9dPmR4
```

Copy those out of the log now — they are not recoverable afterwards — sign in,
and change them. (In development the password is `zup123`, which is what the
login screen hints at. `SEED_DEMO_PASSWORD=true` forces that behaviour on a
throwaway staging box; never set it on a box reachable from the internet.)

Then confirm the site is actually up, from your own machine:

```bash
curl -sI https://<domain>                  | head -1   # 200
curl -s  https://<domain>/api/site-config  | head -c 80 # JSON, not a 500
curl -sI https://api.<domain>/health       | head -1   # 200
```

Then in a browser: the storefront loads **with images** (a wrong
`NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` shows the page but 400s every image), sign
in at `/admin`, upload one product photo (confirms `CLOUDINARY_API_KEY`/
`CLOUDINARY_API_SECRET` on the backend are correct), and place one test order
end to end.

## 7. Day-to-day

Edit → test it locally against the live database (§7.1) → push to `main`,
which builds and publishes images → **Run workflow** to actually roll out.

Publishing and rolling out are two separate acts. A push to `main` runs CI and
pushes SHA-tagged images to GHCR and then stops; the VPS is only touched when
you trigger **Actions → Deploy → Run workflow**. The gate is the `if:` on the
`deploy` job in `.github/workflows/deploy.yml`.

```bash
# logs. Use --since, not --tail: --tail replays history, so a problem you
# already fixed keeps reappearing in the output and looks unfixed.
docker compose --env-file .env.production logs --since=5m backend

# rollback to a known-good commit (images are SHA-tagged, no rebuild)
TAG=<sha> docker compose --env-file .env.production up -d
```

### Deploying by hand

When you need to roll out without going through GitHub — a hotfix, a box that
predates the pipeline, or a registry you have not configured — use the same
script the workflow uses:

```bash
cd /opt/zuptech
git pull origin main
bash scripts/deploy.sh            # pull prebuilt images from the registry
bash scripts/deploy.sh --build    # or build them on the box instead
```

**Do not deploy with a bare `docker compose up -d`.** It applies no migration,
and the resulting failure names something other than its cause: the backend
500s the whole storefront on a missing `SiteConfig` row while its own
`/health` still reports healthy. `scripts/deploy.sh` runs the migration first,
then refuses to finish quietly against an unseeded database. It is
idempotent — re-running against an up-to-date box is a no-op.

### 7.1 Testing against live from a workstation

Runs the production stack — real images, real nginx, two storefront containers,
TLS — on your machine, reading the **live production database** through an SSH
tunnel. Everything is Docker; there is no `bun run dev` in this loop.

```bash
cp .env.live.local.example       .env.live.local        # VPS + db credentials
cp .env.production.local.example .env.production.local  # stack settings
# fill both in, then:

bash scripts/live-tunnel.sh up      # read-only (default)
bash scripts/live-stack.sh  up      # build + start + health-check
# https://zuptech.local:8444
bash scripts/live-stack.sh  down
bash scripts/live-tunnel.sh down
```

Add the local names to `/etc/hosts` once:

```
127.0.0.1  zuptech.local www.zuptech.local api.zuptech.local
```

**Read these three before you rely on it.**

**Schema changes cannot be tested this way.** The live database is on the
migrations live production runs; a change of yours needing a new column has
nowhere to apply it, and applying it to live before the code ships is how you
get an outage. Migration-bearing work goes through the rehearsal stack instead
(above). `scripts/live-guard.sh` refuses `db:migrate`/`db:deploy`/`db:seed`
while `DATABASE_URL` points at the tunnel, and `scripts/live-stack.sh` passes
`--external-db` so `scripts/deploy.sh` never runs `migrate deploy` against
production from a laptop.

**Read-only mode cannot sign in.** The default tunnel connects as `zuptech_ro`
(`deploy/live-readonly-role.sql`, run once on the VPS). Better Auth writes a
`Session` row on every login, so the storefront browses real data fine while
sign-in, checkout and the whole admin panel fail. That is the design, not a
fault.

Expect the failure to name a *read-only transaction*, and note the auth routes
fail for two independent reasons — `allowHitDurable` (`lib/rate-limit.ts`)
also writes a `RateLimitHit` row, so the error you see may point at the rate
limiter rather than the session. Catalog routes use the in-memory `allowHit`
and are unaffected, which is why browsing works at all. `/health` only reads,
so the container still reports healthy.

**Write mode writes to real customer data.** `live-tunnel.sh up --write`
connects as the `zuptech` owner and gives you the full app against the real
catalogue, customers and orders. (Don't size the risk from the row counts in
the restore section above — those are load-test figures. The live database is
small, which makes a bad write easier to miss, not less damaging.) It takes a
`pg_dump` into
`scratchpad/live-backups/` before the tunnel opens — that dump is your only
undo. Close it the moment you are done.

Two safety values in `.env.production.local` are load-bearing and commented as
such: `SMTP_HOST` stays **empty** (real SMTP credentials plus one "forgot
password?" test emails a real customer), and `CLOUDINARY_FOLDER_PREFIX` is
`zuptech-localtest` so a test upload cannot land in the live media folder. Live
photos still render either way — their URLs are absolute.

The stack always **builds**, never pulls: `NEXT_PUBLIC_*` is baked into the
frontend bundle at image build time, so a pulled image would point `next/image`
and every absolute URL at the real domain and the local run would be a lie.

Backups run nightly at 03:15 via the cron entry `scripts/vps-bootstrap.sh`
installed, writing to `/backup` and keeping 14 days. Run one by hand with
`sudo APP_DIR=/opt/zuptech bash /opt/zuptech/scripts/backup.sh`. This covers
Postgres only — media lives on Cloudinary, which has its own backup/export
tooling in the Console.

Those backups sit on the same disk as the app, which does not survive losing
the VPS. Copy them off-box (`rsync`/`rclone` to object storage).

**Restoring.** The dump is `pg_dumpall` output, so it replays into an empty
cluster with plain `psql` — no `pg_restore`, and no database to create first.
Verified end to end against a scratch container: row counts came back identical
to the source (5,010 products, 20,009 orders, 3 staff, 1 SiteConfig).

```bash
docker run -d --name pg-restore-test -e POSTGRES_PASSWORD=x postgres:16-alpine
gunzip -c /backup/pg-YYYY-MM-DD-HHMM.sql.gz | docker exec -i pg-restore-test psql -U postgres
docker exec pg-restore-test psql -U postgres -d zuptech -c 'SELECT count(*) FROM "Product"'
```

`ERROR: role "postgres" already exists` on the way past is expected and
harmless — `pg_dumpall` emits a `CREATE ROLE` for a role the fresh image has
already made. Any *other* error means the dump is not good, which is the whole
reason to run this against a scratch container rather than finding out during
an incident.

## Things that will bite you

**`NEXT_PUBLIC_*` is baked at build time.** Changing a domain or Cloudinary
account means a rebuild, not a restart. That is why those are build args in
`fronend/Dockerfile` and why the frontend image is environment-specific.
Concretely, moving domains means changing `.env.production` on the VPS **and**
the two GitHub repository Variables, then pushing a commit — updating only the
first gets you a correctly routed site serving a bundle that still points
`next/image` at the old host.

**The nginx config is a template, not a live file.** `deploy/nginx/templates/`
is rendered by envsubst at container start. Two consequences: a new
`${PLACEHOLDER}` must be named `*_DOMAIN` or it falls outside
`NGINX_ENVSUBST_FILTER` and renders empty; and the compose `command` calls
`20-envsubst-on-templates.sh` explicitly, because the image only runs its own
entrypoint scripts when the command starts with `nginx` — and ours starts with
`/bin/sh` for the cert-reload loop. Remove that call and nginx silently serves
its default welcome page.

**nginx keeps stale upstream IPs after a container is recreated.** It resolves
each upstream hostname once at startup and holds that address for the life of
the process (the `resolve` parameter that re-resolves is NGINX Plus only).
`docker compose up -d` recreates `backend` / `frontend` when their config or
image changes but leaves `nginx` alone — so nginx goes on dialling IPs that no
longer exist and every request through it 502s until something reloads it.

Observed directly while testing §7.1: a staff login returned 502 from nginx
while the session row it had just created was already committed in the
database. `docker compose exec nginx nginx -s reload` fixes it instantly.

Note what this means for a rollout. `scripts/deploy.sh`'s health checks all
`exec` **into** the containers and the smoke check calls `127.0.0.1:3000` from
inside the backend, so all of them pass while the public site is 502ing — and
the deploy prints "Deployed." The 12-hourly reload loop in the nginx `command`
does eventually recover it, which is a long time to be down. `live-stack.sh`
reloads nginx after every `up` for this reason; `deploy.sh` does not yet.

**`NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` must exactly match `CLOUDINARY_CLOUD_NAME`.**
`next.config.ts`'s `images.remotePatterns` allow-lists
`res.cloudinary.com/<cloud_name>/**` using this value — a mismatch (wrong
cloud name, or unset) makes every product and hero image 400, since Next's
image optimizer refuses to fetch a host/path it hasn't allow-listed.

**CI does not run on pushes to `main` under its own name.** `ci.yml` triggers
on `pull_request` and `workflow_call` only; on `main` it runs *inside* the
Deploy workflow, which calls it as its gate. Tests still gate every deploy —
but if you turn on branch protection, the required status check to select is
the one reported by Deploy (`verify / …`), not a standalone "CI".

**The Postgres init script runs once.** `deploy/postgres-init/` executes only
against an empty `pgdata` volume. Adding a database later means running the
SQL by hand.

**Migrations run before the new code serves**, and `prisma migrate deploy`
only applies committed migrations — it never prompts or resets. Never run
`migrate dev` against production.

**Cloudinary credentials are backend-only.** `CLOUDINARY_API_KEY`/
`CLOUDINARY_API_SECRET` authorize uploads and deletes and must never reach the
browser — only `CLOUDINARY_CLOUD_NAME` (via its `NEXT_PUBLIC_` twin) is safe
to expose, since it's just an account identifier baked into every delivery
URL, not a credential.

**Existing media from the old storage service was migrated once**, via
`backend/prisma/migrate-media-to-cloudinary.ts` (dry-run by default, `--apply`
to commit). If a product photo predates the migration and still looks broken,
re-run that script's dry-run first to see whether the row was missed rather
than assuming it's a fresh bug.

## Still open before real traffic

From `backend/README.md`'s production checklist — these are unfinished in the
code, not in the deployment:

- Payment webhooks (`routes/public/webhooks.ts`) are **stubs**; there is no
  signature verification and no payment-initiation step.
- Password-reset codes are emailed over SMTP (`backend/src/lib/mail.ts`).
  Set `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASS`/`MAIL_FROM` in
  `.env.production` — with `SMTP_HOST` empty the code is only written to the
  container log, so nobody can actually recover a password.
- Staff need a real `email` on their row to use "Forgot password?"; without
  one, another admin has to reset their password for them.
- Seeded staff passwords are random in production and printed once by the seed
  command — capture them from that output and change them after first sign-in.
- The CSP ships as `Content-Security-Policy-Report-Only`
  (`fronend/next.config.ts`). Load the storefront and the admin, confirm the
  browser console reports no violations, then rename the header to
  `Content-Security-Policy` to enforce it.
- Rate limits key on `x-forwarded-for`, counting **one** trusted hop from the
  right: nginx appends the real peer, and Next's proxy passes the header
  through untouched. If you put a CDN or another reverse proxy in front, raise
  `TRUSTED_PROXY_HOPS` to match, or every visitor will share one bucket again.
