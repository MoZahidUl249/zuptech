#!/usr/bin/env bash
#
# Self-signed TLS for running the production stack locally.
#
# The nginx template points at /etc/letsencrypt/live/${APP_DOMAIN}/ because
# that is where certbot puts things on the VPS. Rather than teach it a second
# code path for local runs — which would mean testing a config that isn't the
# one that ships — this drops a self-signed certificate at exactly those paths
# inside the same volume certbot would use. nginx then runs the real template,
# unmodified.
#
#   ./scripts/docker-local-tls.sh zuptech.local api.zuptech.local
#
# The certificate covers the apex, www and the API host, matching the three
# server blocks. Trusting it in the login keychain is a separate, optional step
# printed at the end — without it Chrome shows an interstitial, which is a
# nuisance for a browser pass and irrelevant to curl.
set -euo pipefail

APP_DOMAIN="${1:-zuptech.local}"
API_DOMAIN="${2:-api.${APP_DOMAIN}}"
VOLUME="${3:-zuptech_certbot_conf}"

# Deliberately NOT mktemp -d. On macOS that returns a path under /var/folders,
# and colima only shares $HOME into the VM — so the bind mount below would
# resolve to an empty directory inside the container and the copy would fail on
# a missing file rather than on a missing mount. Staging under the repo keeps
# the path on the shared side.
WORK="$(cd "$(dirname "$0")/.." && pwd)/scratchpad/tls-staging"
rm -rf "$WORK"; mkdir -p "$WORK"
trap 'rm -rf "$WORK"' EXIT

echo "Generating a self-signed certificate for ${APP_DOMAIN}, www.${APP_DOMAIN}, ${API_DOMAIN}…"

# -addext keeps the SANs on the certificate itself. A CN-only certificate is
# rejected outright by every current browser, so the SAN list is the whole job.
openssl req -x509 -nodes -newkey rsa:2048 -sha256 -days 365 \
  -keyout "${WORK}/privkey.pem" \
  -out    "${WORK}/fullchain.pem" \
  -subj   "/CN=${APP_DOMAIN}/O=ZUP TECH local test" \
  -addext "subjectAltName=DNS:${APP_DOMAIN},DNS:www.${APP_DOMAIN},DNS:${API_DOMAIN}" \
  -addext "basicConstraints=critical,CA:TRUE" \
  2>/dev/null

# The volume has to exist before anything can be copied into it; compose would
# create it at `up`, which is too late.
docker volume create "${VOLUME}" >/dev/null

# A throwaway container is the only way to write into a named volume — the
# host has no path to it under colima's VM.
docker run --rm \
  -v "${VOLUME}:/etc/letsencrypt" \
  -v "${WORK}:/src:ro" \
  alpine:3 sh -c "
    mkdir -p /etc/letsencrypt/live/${APP_DOMAIN} &&
    cp /src/fullchain.pem /src/privkey.pem /etc/letsencrypt/live/${APP_DOMAIN}/ &&
    chmod 600 /etc/letsencrypt/live/${APP_DOMAIN}/privkey.pem
  " >/dev/null

echo "Installed into ${VOLUME}:/etc/letsencrypt/live/${APP_DOMAIN}/"

cp "${WORK}/fullchain.pem" "$(dirname "$0")/../scratchpad/local-ca.pem" 2>/dev/null || true

cat <<EOF

To silence the browser warning (optional, needs your password):

  sudo security add-trusted-cert -d -r trustRoot \\
    -k /Library/Keychains/System.keychain scratchpad/local-ca.pem

To remove it afterwards:

  sudo security delete-certificate -c "${APP_DOMAIN}" /Library/Keychains/System.keychain
EOF
