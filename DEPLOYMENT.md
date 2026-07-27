# Deploying ZUP TECH (Docker + GitHub Actions + nginx)

Single VPS, three app services behind nginx, images built by CI and pulled by
the server. Verified end to end: all three images build, the stack boots
healthy, both databases initialise, migrations apply and the storefront serves.

```
                 ┌───────── nginx (:80/:443, only public ports) ─────────┐
 zuptech.com.bd ─┤ frontend:3001   api.… → backend:3000   media.… → storage:3100
                 └───────────────────────────────────────────────────────┘
                             backend ─┐            storage ─┐
                                      └──► postgres (zuptech + media_storage)
```

## 0. Prerequisites

- A VPS (2 GB RAM minimum — the Next.js build runs in CI, not here).
- Three DNS A records → the VPS IP: `zuptech.com.bd`, `api.zuptech.com.bd`,
  `media.zuptech.com.bd`. **Do this first**; certificate issuance fails
  otherwise.
- A GitHub repo. This project is **not yet a git repo** — see §1.

## 1. Put the code in git

```bash
cd "/path/to/actual soft"
git init && git branch -M main
git add -A && git commit -m "Initial commit"
git remote add origin git@github.com:YOU/zuptech.git
git push -u origin main
```

Before the first commit, confirm no secrets are staged:

```bash
git status --porcelain | grep -E '\.env$|\.env\.' && echo "STOP — secrets staged"
```

`backend/.env` and `storage/.env` hold live credentials. The root `.gitignore`
is currently empty — add at least `.env`, `node_modules/`, `.next/`,
`storage/data/`, `backend/src/generated/`.

## 2. Prepare the VPS

```bash
ssh root@VPS
curl -fsSL https://get.docker.com | sh
adduser --disabled-password --gecos "" deploy
usermod -aG docker deploy
mkdir -p /opt/zuptech && chown deploy:deploy /opt/zuptech
```

As `deploy`:

```bash
git clone https://github.com/YOU/zuptech.git /opt/zuptech
cd /opt/zuptech
cp .env.production.example .env.production
chmod 600 .env.production
```

Fill in `.env.production`. Generate each secret separately:

```bash
openssl rand -hex 32   # BETTER_AUTH_SECRET
openssl rand -hex 32   # STORAGE_API_KEY
openssl rand -hex 24   # each DB password
```

Set `REGISTRY=ghcr.io/YOU/zuptech`.

## 3. Certificates (once, before nginx can start on 443)

The nginx config references certs that do not exist yet, so issue them with a
throwaway standalone server first:

```bash
cd /opt/zuptech
docker run --rm -p 80:80 \
  -v zuptech_certbot_conf:/etc/letsencrypt \
  certbot/certbot certonly --standalone \
  -d zuptech.com.bd -d www.zuptech.com.bd \
  -d api.zuptech.com.bd -d media.zuptech.com.bd \
  --email you@example.com --agree-tos --no-eff-email
```

All four names go on **one** certificate — `deploy/nginx/conf.d/zuptech.conf`
points every server block at `live/zuptech.com.bd/`. Renewal is automatic
afterwards: the `certbot` service renews every 12h and nginx reloads on the
same cycle.

## 4. GitHub configuration

**Secrets** (Settings → Secrets and variables → Actions → Secrets):

| Name | Value |
|---|---|
| `VPS_HOST` | server IP |
| `VPS_USER` | `deploy` |
| `VPS_SSH_KEY` | private key whose public half is in `deploy`'s `authorized_keys` |

**Variables** (same page → Variables). These are inlined into public
JavaScript, so they are variables, not secrets:

| Name | Value |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | `https://zuptech.com.bd` |
| `NEXT_PUBLIC_STORAGE_URL` | `https://media.zuptech.com.bd` |

Create an **Environment** called `production` (Settings → Environments). Add
required reviewers there if you want deploys to pause for approval.

## 5. First deploy

Push to `main`, or run the *Deploy* workflow manually. The pipeline:

1. **CI** — typecheck all three packages, lint, run backend + storage tests.
2. **publish** — build and push all three images to GHCR, tagged `latest` and
   the commit SHA.
3. **deploy** — SSH in, `git reset --hard origin/main`, pull images, run
   migrations, `up -d`, prune old layers, then poll `/health`.

Seed the catalog once, on the first deploy only:

```bash
cd /opt/zuptech
docker compose --env-file .env.production run --rm backend bun run db:seed
```

Then **change the demo staff passwords immediately** — the seed creates
`arif`/`nusrat`/`rakib` with the password `zup123`.

## 6. Day-to-day

Edit locally → `bun run dev` → commit → push to `main`. That is the whole
loop; CI gates it and the deploy runs itself.

```bash
# logs
docker compose --env-file .env.production logs -f backend

# rollback to a known-good commit (images are SHA-tagged, no rebuild)
TAG=<sha> docker compose --env-file .env.production up -d

# backup — BOTH are required for a full restore
docker compose --env-file .env.production exec -T db \
  pg_dumpall -U postgres | gzip > /backup/pg-$(date +%F).sql.gz
docker run --rm -v zuptech_media_data:/data -v /backup:/out \
  alpine tar czf /out/media-$(date +%F).tar.gz -C /data .
```

## Things that will bite you

**`NEXT_PUBLIC_*` is baked at build time.** Changing a domain means a rebuild,
not a restart. That is why those are build args in `fronend/Dockerfile` and
why the frontend image is environment-specific.

**`NEXT_PUBLIC_STORAGE_URL` must be a public HTTPS origin.** Next 16 refuses
to optimize images whose host resolves to a private IP. `next.config.ts` opts
out of that guard only when `NODE_ENV=development`, so pointing this at
`localhost` in production makes every product and hero image return 400.

**The Postgres init script runs once.** `deploy/postgres-init/` executes only
against an empty `pgdata` volume. Adding a database later means running the
SQL by hand.

**Migrations run before the new code serves**, and `prisma migrate deploy`
only applies committed migrations — it never prompts or resets. Never run
`migrate dev` against production.

**nginx disables buffering on `/files/`.** Video is served with HTTP Range;
buffering makes nginx swallow the whole response and silently breaks seeking.

## Still open before real traffic

From `backend/README.md`'s production checklist — these are unfinished in the
code, not in the deployment:

- Payment webhooks (`routes/public/webhooks.ts`) are **stubs**; there is no
  signature verification and no payment-initiation step.
- OTP delivery has no SMS gateway wired into `sendVerificationOTP`.
- Seeded demo staff passwords must be changed.
