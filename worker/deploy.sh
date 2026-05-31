#!/usr/bin/env bash
# VPS-side deploy script. Invoked by GitHub Actions over SSH:
#   ssh root@$VPS_HOST 'bash -s' < worker/deploy.sh
#
# Assumes the repo is already cloned at /root/jobpilot and Docker is installed.
# Safe to run manually too:  bash /root/jobpilot/worker/deploy.sh
set -euo pipefail

REPO_DIR="${REPO_DIR:-/root/jobpilot}"
WORKER_DIR="$REPO_DIR/worker"
BRANCH="${BRANCH:-main}"

echo "==> Pulling latest from origin/$BRANCH"
cd "$REPO_DIR"
git fetch --prune origin
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"

cd "$WORKER_DIR"

if [ ! -f .env ]; then
  echo "ERROR: $WORKER_DIR/.env missing. Fill it in before deploying." >&2
  exit 1
fi

echo "==> docker compose up -d --build"
docker compose up -d --build

echo "==> Waiting 15s for container to settle..."
sleep 15

echo "==> docker compose ps"
docker compose ps

STATUS="$(docker compose ps --format '{{.State}}' worker 2>/dev/null || true)"
if [ "$STATUS" != "running" ]; then
  echo "ERROR: worker container is not running (state=$STATUS)" >&2
  echo "==> Last 50 log lines:" >&2
  docker compose logs --tail=50 worker >&2 || true
  exit 1
fi

echo "==> Last 20 log lines:"
docker compose logs --tail=20 worker

echo "==> Deploy OK"
