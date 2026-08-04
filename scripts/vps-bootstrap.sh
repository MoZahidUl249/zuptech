#!/usr/bin/env bash
# One-time preparation of a fresh Debian/Ubuntu VPS to host this stack.
#
#   ssh root@VPS 'bash -s' < scripts/vps-bootstrap.sh
#
# Idempotent: safe to re-run. Every step checks for its own result first, so a
# second run reports "already done" rather than duplicating anything.
#
# What this does NOT do — deliberately, because each needs a human decision or
# a secret that must not live in a repo:
#   * clone the repo            (needs the deploy key — DEPLOYMENT.md §2)
#   * write .env.production     (secrets)
#   * issue TLS certificates    (needs DNS to be live first — §4)
set -euo pipefail

DEPLOY_USER="${DEPLOY_USER:-deploy}"
APP_DIR="${APP_DIR:-/opt/zuptech}"
SWAP_SIZE="${SWAP_SIZE:-2G}"
SSH_PORT="${SSH_PORT:-22}"

log()  { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
skip() { printf '    (already done: %s)\n' "$*"; }

if [ "$(id -u)" -ne 0 ]; then
  echo "Run as root: ssh root@VPS 'bash -s' < scripts/vps-bootstrap.sh" >&2
  exit 1
fi

# ---------- Docker ----------
log "Docker"
if command -v docker >/dev/null 2>&1; then
  skip "$(docker --version)"
else
  curl -fsSL https://get.docker.com | sh
fi

# ---------- Log rotation ----------
# The single most common way a small VPS dies: container logs grow without
# bound until the disk is full, and every service fails at once with errors
# that point anywhere but the real cause. Docker does NOT rotate by default.
log "Docker log rotation"
if [ -f /etc/docker/daemon.json ]; then
  skip "/etc/docker/daemon.json exists — leaving it alone"
  echo "    verify it sets log-opts max-size/max-file, or logs will grow unbounded"
else
  mkdir -p /etc/docker
  cat > /etc/docker/daemon.json <<'JSON'
{
  "log-driver": "json-file",
  "log-opts": { "max-size": "10m", "max-file": "3" }
}
JSON
  systemctl restart docker
  echo "    capped at 10m x 3 per container"
fi

# ---------- Swap ----------
# Postgres plus three runtimes on a 2 GB box has no headroom. Without swap the
# OOM killer picks the largest RSS, which is usually Postgres — the one process
# whose death loses data.
log "Swap"
if swapon --show | grep -q .; then
  skip "$(swapon --show=NAME,SIZE --noheadings | tr '\n' ' ')"
else
  fallocate -l "$SWAP_SIZE" /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
  chmod 600 /swapfile
  mkswap /swapfile >/dev/null
  swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  echo "    $SWAP_SIZE swapfile active"
fi

# ---------- Deploy user ----------
log "Deploy user: $DEPLOY_USER"
if id "$DEPLOY_USER" >/dev/null 2>&1; then
  skip "user exists"
else
  adduser --disabled-password --gecos "" "$DEPLOY_USER"
fi
usermod -aG docker "$DEPLOY_USER"
install -d -o "$DEPLOY_USER" -g "$DEPLOY_USER" -m 755 "$APP_DIR"
install -d -o "$DEPLOY_USER" -g "$DEPLOY_USER" -m 700 "/home/$DEPLOY_USER/.ssh"

# ---------- Firewall ----------
# Order matters: SSH is allowed BEFORE enabling, or this locks you out of the
# box you are currently connected to.
log "Firewall"
if ! command -v ufw >/dev/null 2>&1; then
  apt-get update -qq && apt-get install -y -qq ufw
fi
ufw allow "$SSH_PORT"/tcp   >/dev/null
ufw allow 80/tcp            >/dev/null
ufw allow 443/tcp           >/dev/null
ufw --force enable          >/dev/null
echo "    open: $SSH_PORT, 80, 443 — everything else refused"
echo "    (Postgres and the app services publish no host ports at all)"

# ---------- Backups ----------
# Media (product photos/video, hero images, service images) lives on
# Cloudinary, so this backs up Postgres only.
log "Nightly backups"
install -d -m 750 /backup
if crontab -l 2>/dev/null | grep -q 'zuptech-backup'; then
  skip "cron entry present"
else
  ( crontab -l 2>/dev/null || true
    echo "15 3 * * * APP_DIR=$APP_DIR bash $APP_DIR/scripts/backup.sh >> /var/log/zuptech-backup.log 2>&1  # zuptech-backup"
  ) | crontab -
  echo "    03:15 daily -> /backup, logged to /var/log/zuptech-backup.log"
fi

cat <<EOF

Done. Next, as $DEPLOY_USER:

  1. Create the GitHub deploy key and clone into $APP_DIR   (DEPLOYMENT.md §2)
  2. cp .env.production.example .env.production && chmod 600 .env.production
  3. Fill it in, then issue certificates                    (DEPLOYMENT.md §4)

Backups only start working once step 1 has put scripts/backup.sh in place.
EOF
