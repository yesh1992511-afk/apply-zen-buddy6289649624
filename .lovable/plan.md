## Plan

1. **Make the worker import resilient**
   - Update `worker/app/apply/browser.py` so the worker does not crash at startup if `playwright-stealth` changes its export shape again.
   - Keep stealth enabled when available, but make it optional/fail-safe so browser startup can continue.

2. **Keep dependency fix permanent**
   - Keep `setuptools>=68` in `worker/pyproject.toml` because `playwright-stealth` 1.x imports `pkg_resources`, which comes from setuptools on Python 3.12.
   - Keep `playwright-stealth>=1.0.6,<2` to avoid the 2.x API mismatch that removed `stealth_async`.

3. **Add a simple import compatibility path**
   - Support both common forms:
     - `from playwright_stealth import stealth_async`
     - fallback to `from playwright_stealth.stealth import stealth_async`
   - If neither works, set stealth to `None` and skip only that optional stealth call.

4. **Server commands after code is updated**
   - On your server, pull the new code and recreate the worker:

```bash
cd ~/jobpilot/worker
git pull
docker compose build worker
docker compose up -d --force-recreate worker
docker compose logs -f worker
```

Expected result: no `stealth_async` import error, no `pkg_resources` error, and the worker stays running instead of restarting.