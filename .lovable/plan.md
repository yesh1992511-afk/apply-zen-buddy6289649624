# Why the captcha row stays red

The Worker setup checklist does **not** read your VPS `.env` file. It reads a database table (`secrets_meta`) that tracks *which secret names are configured*. Right now nothing writes to that table, so even though `CAPTCHA_API_KEY` and `PROXY_HOST` are sitting in the worker's `.env` on Hostinger, the UI has no way to know.

Clicking the red row in the frontend opens `/setup`, but `/setup` currently only shows the readiness list — it has no form to "mark configured" either. That's why nothing happens when you click.

# Fix: let the worker tell the database what it has

The worker already pings the database every 30s (`worker/app/heartbeat.py`). We extend that same heartbeat to also upsert one row per configured secret into `secrets_meta`. As soon as you redeploy the worker, the UI flips Captcha → green and Proxy → green automatically.

This is the right architecture because:
- The worker is the only thing that actually knows whether the env var is set.
- No new secrets, no frontend form, no manual sync step.
- Same pattern as the existing heartbeat (one extra upsert per 30s tick).

## Changes

**1. `worker/app/heartbeat.py`** — extend `beat()` to also upsert `secrets_meta` rows based on which env vars are non-empty:

| Env var present | secrets_meta row written |
|---|---|
| `CAPTCHA_API_KEY` | `name=CAPTCHA_API_KEY, category=captcha, status=set` |
| `PROXY_HOST` + `PROXY_USER` | `name=PROXY_HOST, category=proxy, status=set` |
| `APIFY_TOKEN` | `name=APIFY_TOKEN, category=apify, status=set` |
| `OPENAI_API_KEY` | `name=OPENAI_API_KEY, category=ai, status=set` |
| `GMAIL_OAUTH_REFRESH_TOKEN` | `name=GMAIL_OAUTH_REFRESH_TOKEN, category=gmail, status=set` |

Upsert on `(user_id, name)` (the table already has that unique constraint). Use `status='set'` when the value is non-empty, `status='unset'` otherwise so removing a key also reflects in the UI.

**2. `worker/app/config.py`** — expose the captcha/proxy/gmail fields as settings if they aren't already (read with defaults so missing keys don't crash).

**3. `worker/VERSION`** — bump to `0.1.1` so the UI's "Worker heartbeat" row shows the new version, confirming the new build is live.

**4. Frontend** — no changes needed. `ReadinessChecklist` already re-queries every 30s.

## Rollout for you

1. I push the worker changes.
2. On Hostinger: `cd /opt/jobpilot-worker && git pull && docker compose up -d --build` (or your existing deploy script — `worker/deploy.sh` already exists).
3. Within ~30s the Worker setup page flips Captcha → green and Proxy → green.

## Out of scope

- No changes to scraping, source adapters, or cron jobs (Phase A stays as-is).
- No new secrets requested — the values you already put in `.env` on the VPS are all that's needed.
- No "manual mark configured" UI — we don't need it once the worker self-reports.
