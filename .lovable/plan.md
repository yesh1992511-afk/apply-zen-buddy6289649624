## What the logs show

The worker is now starting successfully, but every database request is failing with:

```text
401 Unauthorized: Invalid API key
```

This means the Docker worker is using a wrong, expired, or copied-truncated `SUPABASE_SERVICE_ROLE_KEY` in `worker/.env`. The worker code is reading `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` correctly, but the value on the server is not accepted by the backend.

There is also a secondary warning:

```text
This feature isn't available in the sync client. You can use the realtime feature in the async client only.
```

That realtime warning is not the main blocker, but it will keep repeating in logs.

## Plan

1. Add safer worker startup validation
   - Validate that `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `JOBPILOT_USER_ID` look valid before the scheduler starts.
   - Run a small backend health/query check at boot.
   - If the key is invalid, log one clear message and stop instead of flooding logs every 5 seconds.

2. Make scheduled command polling resilient
   - Wrap `tick_commands()` database polling in a try/except so API failures do not produce repeated APScheduler tracebacks.
   - Log a concise `commands_poll_failed` warning.

3. Remove or disable the broken sync realtime listener
   - Since the current sync Python client cannot use realtime, disable that listener path.
   - Keep the normal 2-minute scheduler polling, so sources still run without realtime.

4. Update server instructions
   - Add exact safe commands for checking `.env` without printing secrets.
   - Tell you which key must be replaced on the VPS: `SUPABASE_SERVICE_ROLE_KEY`.
   - Then rebuild/recreate the worker.

## What you will need to do on the server after this code change

You will still need to update the secret in `~/jobpilot/worker/.env`; code cannot fix an invalid key stored on the VPS.

The important check is:

```bash
cd ~/jobpilot/worker
nano .env
```

Make sure:

```text
SUPABASE_URL=https://iarfebnnnoswymgfvnel.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<real service role key, not anon key>
JOBPILOT_USER_ID=6143b580-35ac-4204-9807-1cf07f6fcff7
```

Then run:

```bash
docker compose build worker
docker compose up -d --force-recreate worker
docker compose logs -f worker
```

Expected result: no `Invalid API key` messages, heartbeat succeeds, and the worker keeps running cleanly.