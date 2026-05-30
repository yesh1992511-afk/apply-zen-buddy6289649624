# Fix: `ImportError: cannot import name 'stealth_async'`

## Cause

`worker/pyproject.toml` declares `playwright-stealth>=1.0.6`. Pip resolved that to the new **2.x** release, which renamed/removed the top-level `stealth_async` function — the codebase still imports the 1.x API in `worker/app/apply/browser.py` line 11.

## Fix (one line)

Edit `worker/pyproject.toml` and constrain the package below 2.0:

```diff
- "playwright-stealth>=1.0.6",
+ "playwright-stealth>=1.0.6,<2",
```

This keeps `browser.py` untouched and avoids a wider rewrite for the 2.x API.

## Rebuild + restart on the server

```bash
cd ~/jobpilot/worker
git pull
docker compose build --no-cache worker
docker compose up -d
docker compose logs -f worker
```

## Expected log output

- `worker starting v0.1.0`
- `scheduler started`
- `realtime sources listener subscribed`
- No more `ImportError` / restart loop

If you'd rather not rebuild the full image (the base layer took ~7 min), the alternative is a quick in-container patch:

```bash
docker compose exec worker pip install 'playwright-stealth<2'
docker compose restart worker
```

…but the change won't survive the next `--build`, so the `pyproject.toml` pin is still the proper fix.
