#!/usr/bin/env bash
# One-shot VPS installer for JobPilot worker.
# Run on a fresh Ubuntu 22.04 / 24.04 box as root:
#
#   curl -fsSL https://raw.githubusercontent.com/<you>/<repo>/main/worker/bootstrap.sh | bash
#
# Or, if you scp'd this repo to /root/jobpilot:
#   bash /root/jobpilot/worker/bootstrap.sh
set -euo pipefail

REPO_DIR="${REPO_DIR:-/root/jobpilot}"
WORKER_DIR="$REPO_DIR/worker"

echo "==> Installing Docker if missing..."
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi

if [ ! -d "$WORKER_DIR" ]; then
  echo "ERROR: $WORKER_DIR not found. Clone or scp this repo to $REPO_DIR first." >&2
  exit 1
fi

cd "$WORKER_DIR"

if [ ! -f .env ]; then
  echo "ERROR: $WORKER_DIR/.env missing. Copy .env from the Lovable repo (it has your real keys)." >&2
  exit 1
fi

echo "==> Checking required env vars..."
required=(SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY JOBPILOT_USER_ID APIFY_TOKEN OPENAI_API_KEY DEEPSEEK_API_KEY CAPTCHA_API_KEY PROXY_HOST PROXY_USER PROXY_PASS)
missing=()
for v in "${required[@]}"; do
  if ! grep -qE "^${v}=.+" .env || grep -qE "^${v}=REPLACE_ME" .env; then
    missing+=("$v")
  fi
done
if [ ${#missing[@]} -gt 0 ]; then
  echo "ERROR: missing values in .env: ${missing[*]}" >&2
  echo "Edit $WORKER_DIR/.env and fill them in, then re-run." >&2
  exit 1
fi

mkdir -p data/profiles

echo "==> Building & starting worker..."
docker compose up -d --build

echo
echo "==> Following logs (Ctrl-C to detach; worker keeps running)..."
docker compose logs -f worker
