## Why the SQL editor failed

The Cloud SQL editor connects as a restricted role that doesn't have write access to `vault.secrets` (Supabase protects that table). That's why you saw `ERROR 42501: permission denied for table secrets`. I have an admin path that can write there.

## Plan

### Step 1 — Sync the current secret into the Vault (I do this)

Update the Vault entry `worker_cron_secret` to the value you already set as the `WORKER_CRON_SECRET` project secret:

```
0894ea1b2d117f9b1c383c608a7a8133b7e21979af69c1002bcb2b4c170e0e32
```

After this, the pg_cron heartbeat + daily-summary jobs will start successfully authenticating against `/api/public/hooks/*`.

### Step 2 — Verify it works

Check the most recent cron run history in the Cloud SQL editor (this query is read-only, no permission issue):

```sql
SELECT jobname, status, return_message, start_time
FROM cron.job_run_details
ORDER BY start_time DESC
LIMIT 5;
```

We expect `succeeded` rows for `jobpilot-heartbeat-check` and `jobpilot-daily-summary-tick`.

### Step 3 (recommended) — Rotate, because the secret leaked in the screenshot

Since the value is now visible in our chat, generate a fresh one and rotate **both places** so they match:

1. Generate a new random string (e.g. `openssl rand -hex 32`).
2. You update the project secret `WORKER_CRON_SECRET` to the new value (Cloud → Secrets → edit).
3. I update the Vault entry `worker_cron_secret` to the same new value via the admin path.

If you'd rather skip rotation right now, that's fine — Step 1 alone unblocks cron. Just don't share the screenshot publicly.

## Technical details

- The Vault entry was seeded with a placeholder `CHANGE_ME_REPLACE_WITH_REAL_SECRET` by the earlier migration. pg_cron reads it from `vault.decrypted_secrets` and sends it as `x-internal-secret`.
- The server route handlers compare incoming `x-internal-secret` (constant-time) against `process.env.WORKER_CRON_SECRET`. They must be byte-identical.
- The admin path uses elevated access to write `vault.secrets` directly. The Cloud SQL editor cannot, by design.
