## Status

Good news: the worker is healthy. Auth works, the heartbeat is succeeding, the scheduler is running, and `compile_resume` jobs for the valid resume `52aeb6c0…` are completing and uploading PDFs to storage.

The remaining noise is two unrelated minor issues:

1. **HTTP 406 on a deleted resume.** A stack of old `compile_resume` commands references resume id `36948da0-8f3e-4b92-bfc5-728a244ca945`, which no longer exists for your user. `worker/app/commands.py:101` uses `.single()`, which returns 406 Not Acceptable when zero rows match, producing `command_failed` tracebacks. Valid resumes still compile fine — this only affects the stale rows.

2. **`realtime_listener_failed` warning.** Cosmetic. The sync supabase-py client can't open a realtime subscription; the scheduler poll already covers this. We can silence the warning.

## Fix

### 1. `worker/app/commands.py` — handle missing resume cleanly

In `_do_compile_resume` (around lines 94–115):

- Replace `.single()` with `.maybe_single()` so a missing row returns `None` instead of HTTP 406.
- If `row` is `None`, raise `ValueError(f"resume {resume_id} not found")`. The existing `tick_commands` wrapper will mark the worker_command as failed with a clean one-line error (no traceback spam, no 406 in HTTP logs).

### 2. `worker/app/main.py` — drop the realtime warning

Remove (or downgrade to `debug`) the `realtime_listener_failed` log line, since we intentionally don't use realtime in the sync client and the scheduler poll is the source of truth.

### 3. Clear the stale pending commands (one-time, on the VPS)

The queue still contains old `compile_resume` rows pointing at the deleted resume. After the code fix they'll fail cleanly instead of looping with 406s, but you can also just mark them done so the log stops mentioning them. From the VPS, run once:

```bash
docker compose exec worker python -c "
from app.db import db, user_id
res = db().table('worker_commands').update({'status':'failed','error':'stale: resume deleted'}).eq('user_id', user_id()).eq('status','pending').eq('kind','compile_resume').execute()
print('cleared', len(res.data or []))
"
```

(Or skip this — the new code will drain them on the next tick.)

### 4. Redeploy

```bash
cd ~/jobpilot/worker
git pull
docker compose build worker
docker compose up -d --force-recreate worker
docker compose logs -f worker
```

## Expected result

- No more `HTTP/2 406` or `command_failed` tracebacks.
- No more `realtime_listener_failed` warning at boot.
- Valid `compile_resume` jobs continue to succeed (as `52aeb6c0…` already is).
- Heartbeat, source polling, and apply ticks keep running on their normal schedule.

Approve and I'll apply the two code changes.