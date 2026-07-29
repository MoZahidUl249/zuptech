# Deploying ZUP TECH (Docker + GitHub Actions + nginx)

Single VPS, three app services behind nginx, images built by CI and pulled by
the server. Verified end to end: all three images build, the stack boots
healthy, both databases initialise, migrations apply and the storefront serves.

```
             ┌───────── nginx (:80/:443, the only public ports) ─────────┐
 <domain> ───┤ frontend:3001   api.<domain> → backend:3000
             │                 media.<domain> → storage:3100  (/files/ only)
             └──────────────────────────────────────────────────────────┘
                         backend ─┐             storage ─┐
                                  └──► postgres (zuptech + media_storage)
```

Throughout, `<domain>` is the site's domain (e.g. `example.com`). It appears in
exactly three places: `.env.production` on the VPS, two GitHub repository
Variables, and the certificate. Nothing else hardcodes it — the nginx config is
a template rendered at container start.

## 0. Prerequisites

- A VPS (2 GB RAM minimum — the Next.js build runs in CI, not here).
- Four DNS A records → the VPS IP: `<domain>`, `www.<domain>`,
  `api.<domain>`, `media.<domain>`. **Do this first**; certificate issuance
  fails otherwise, and DNS takes time to propagate.
- A GitHub repo with the code pushed to `main`.

Before the first push, confirm no secrets are staged — `backend/.env` and
`storage/.env` hold live credentials:

```bash
git status --porcelain | grep -E '\.env$|\.env\.' && echo "STOP — secrets staged"
```

(The root `.gitignore` already excludes `.env`, `node_modules/`, `.next/`,
`storage/data/` and `backend/src/generated/`.)

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
openssl rand -hex 32   # STORAGE_API_KEY
openssl rand -hex 24   # each of the three DB passwords
```

Then set:

- `APP_DOMAIN`, `API_DOMAIN`, `MEDIA_DOMAIN` — bare hostnames, no scheme
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
  -d <domain> -d www.<domain> -d api.<domain> -d media.<domain> \
  --email you@example.com --agree-tos --no-eff-email
```

All four names go on **one** certificate, and every nginx server block points
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
| `NEXT_PUBLIC_STORAGE_URL` | `https://media.<domain>` |

Create an **Environment** called `production` (Settings → Environments). Leave
required reviewers empty for fully automatic deploys, or add yourself to make
every release pause for a click.

## 6. First deploy

Push to `main`, or run the *Deploy* workflow manually. The pipeline:

1. **CI** — typecheck all three packages, lint, run backend + storage tests.
2. **publish** — build and push all three images to GHCR, tagged `latest` and
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
curl -sI https://media.<domain>/media      | head -1   # 404 — write API not public
```

Then in a browser: the storefront loads **with images** (a wrong
`NEXT_PUBLIC_STORAGE_URL` shows the page but 400s every image), sign in at
`/admin`, and place one test order end to end.

## 7. Day-to-day

Edit locally → `bun run dev` → commit → push to `main`. That is the whole
loop; CI gates it and the deploy runs itself.

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

**Do not deploy with a bare `docker compose up -d`.** It applies neither
migration history, and both resulting failures name something other than their
cause: the storage service answers every request with `relation "media" does
not exist`, and the backend 500s the whole storefront on a missing `SiteConfig`
row while its own `/health` still reports healthy. `scripts/deploy.sh` runs
both migrations first, then refuses to finish quietly against an unseeded
database. It is idempotent — re-running against an up-to-date box is a no-op.

Backups run nightly at 03:15 via the cron entry `scripts/vps-bootstrap.sh`
installed, writing to `/backup` and keeping 14 days. Run one by hand with
`sudo APP_DIR=/opt/zuptech bash /opt/zuptech/scripts/backup.sh`. **Both**
artefacts are needed for a full restore — the database alone leaves every
product photo pointing at a file that no longer exists.

Those backups sit on the same disk as the app, which does not survive losing
the VPS. Copy them off-box (`rsync`/`rclone` to object storage) and test a
restore before you rely on either.

## Things that will bite you

**`NEXT_PUBLIC_*` is baked at build time.** Changing a domain means a rebuild,
not a restart. That is why those are build args in `fronend/Dockerfile` and
why the frontend image is environment-specific. Concretely, moving domains
means changing `.env.production` on the VPS **and** the two GitHub repository
Variables, then pushing a commit — updating only the first gets you a correctly
routed site serving a bundle that still calls the old media host.

**The nginx config is a template, not a live file.** `deploy/nginx/templates/`
is rendered by envsubst at container start. Two consequences: a new
`${PLACEHOLDER}` must be named `*_DOMAIN` or it falls outside
`NGINX_ENVSUBST_FILTER` and renders empty; and the compose `command` calls
`20-envsubst-on-templates.sh` explicitly, because the image only runs its own
entrypoint scripts when the command starts with `nginx` — and ours starts with
`/bin/sh` for the cert-reload loop. Remove that call and nginx silently serves
its default welcome page.

**`NEXT_PUBLIC_STORAGE_URL` must be a public HTTPS origin.** Next 16 refuses
to optimize images whose host resolves to a private IP. `next.config.ts` opts
out of that guard only when `NODE_ENV=development`, so pointing this at
`localhost` in production makes every product and hero image return 400.

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

**There are two databases with two separate migration histories**, and
`docker-compose.yml` applies neither. `zuptech` is migrated by Prisma,
`media_storage` by `storage/migrations/run-migrations.ts` — forgetting the
second is easy, because the backend comes up perfectly and only the media
service fails. `scripts/deploy.sh` runs both; use it rather than remembering.

**nginx disables buffering on `/files/`.** Video is served with HTTP Range;
buffering makes nginx swallow the whole response and silently breaks seeking.

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
- The media host publishes `/files/` only. The storage write API stays on the
  internal compose network — don't add a catch-all `location /` back to it.
