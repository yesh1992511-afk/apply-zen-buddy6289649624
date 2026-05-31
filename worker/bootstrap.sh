#!/usr/bin/env bash
# One-shot VPS installer for JobPilot worker.
#
# Now pulls runtime secrets from Lovable Cloud at startup so you only manage
# them in one place. Required local seed in worker/.env:
#   SUPABASE_URL=<from Lovable Cloud → Cloud settings>
#   SUPABASE_SERVICE_ROLE_KEY=<from Lovable Cloud → Cloud settings>
#   JOBPILOT_USER_ID=<your auth.users.id>
#   WORKER_ENV_URL=https://apply-zen-buddy.lovable.app/api/public/worker/env
#
# Everything else (APIFY_TOKEN, OPENAI_API_KEY, DECODO_*, CAPSOLVER_*, GMAIL_*,
# APPLY_*, …) is fetched from /api/public/worker/env on every boot.
#
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
  echo "ERROR: $WORKER_DIR/.env missing. Create it with at minimum:" >&2
  echo "  SUPABASE_URL=..." >&2
  echo "  SUPABASE_SERVICE_ROLE_KEY=..." >&2
  echo "  JOBPILOT_USER_ID=..." >&2
  echo "  WORKER_ENV_URL=https://apply-zen-buddy.lovable.app/api/public/worker/env" >&2
  exit 1
fi

# Load seed vars from .env (just the ones we need to talk to Lovable Cloud)
SEED_VARS=(SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY JOBPILOT_USER_ID)
for v in "${SEED_VARS[@]}"; do
  if ! grep -qE "^${v}=.+" .env || grep -qE "^${v}=REPLACE_ME" .env; then
    echo "ERROR: seed value missing in .env: $v" >&2
    exit 1
  fi
done

WORKER_ENV_URL="$(grep -E '^WORKER_ENV_URL=' .env | head -1 | cut -d= -f2- | tr -d '"' || true)"
WORKER_ENV_URL="${WORKER_ENV_URL:-https://apply-zen-buddy.lovable.app/api/public/worker/env}"
SERVICE_KEY="$(grep -E '^SUPABASE_SERVICE_ROLE_KEY=' .env | head -1 | cut -d= -f2- | tr -d '"')"

echo "==> Syncing secrets from Lovable Cloud → $WORKER_ENV_URL ..."
if ! REMOTE_ENV="$(curl -fsSL -H "Authorization: Bearer ${SERVICE_KEY}" "$WORKER_ENV_URL")"; then
  echo "WARN: could not fetch worker env from Lovable Cloud — continuing with existing .env" >&2
else
  # Append/replace each remote var into .env without losing the seed vars.
  TMP=$(mktemp)
  cp .env "$TMP"
  python3 - "$TMP" "$REMOTE_ENV" <<'PY'
import json, sys, re, pathlib
path = pathlib.Path(sys.argv[1])
remote = json.loads(sys.argv[2])
lines = path.read_text().splitlines()
existing = {}
for i, ln in enumerate(lines):
    m = re.match(r"^([A-Z0-9_]+)=", ln)
    if m:
        existing[m.group(1)] = i
for k, v in remote.items():
    safe = v.replace("\n", "\\n")
    entry = f'{k}={safe}'
    if k in existing:
        lines[existing[k]] = entry
    else:
        lines.append(entry)
path.write_text("\n".join(lines) + "\n")
PY
  echo "    synced $(echo "$REMOTE_ENV" | python3 -c 'import json,sys; print(len(json.load(sys.stdin)))') keys"
fi

mkdir -p data/profiles

echo "==> Building & starting worker..."
docker compose up -d --build

echo
echo "==> Following logs (Ctrl-C to detach; worker keeps running)..."
docker compose logs -f worker
