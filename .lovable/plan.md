# Fix: `ModuleNotFoundError: No module named 'pkg_resources'`

## Cause

`playwright-stealth` 1.x does `import pkg_resources` at import time. `pkg_resources` ships with **setuptools**, which is no longer pre-installed in Python 3.12 base images. The Playwright base image used here doesn't include it, so the import crashes the worker.

## Fix

Add `setuptools` to the worker dependencies so `pkg_resources` is available.

Edit `worker/pyproject.toml`:

```diff
   "playwright-stealth>=1.0.6,<2",
+  "setuptools>=68",
```

## Rebuild + restart on the server

```bash
cd ~/jobpilot/worker
git pull
docker compose build worker
docker compose up -d --force-recreate worker
docker compose logs -f worker
```

(No `--no-cache` needed; only the `pip install` layer re-runs, ~30–60s.)

## Expected log output

- `worker starting v0.1.0`
- `scheduler started`
- `realtime sources listener subscribed`
- No more `ImportError` / restart loop

## Quick in-container test (optional, before rebuild)

```bash
docker compose exec worker pip install setuptools
docker compose restart worker
docker compose logs -f worker
```

If that boots cleanly, the `pyproject.toml` change is the permanent fix.
