# One-shot batch: scrape until N matched, then auto-apply

A single button that scrapes source-by-source until N matched jobs are inserted, then stops scraping. The existing apply worker (pg_cron every minute + `auto_queue_matched_job` trigger) submits the resulting applications automatically. Default N = 10, user-adjustable (1–50).

## How it works end-to-end

1. User clicks **"Run batch (10)"** on `/jobs`.
2. Client calls `runOneShotBatch` server fn (auth-protected).
3. Server fn:
   - Reads `automation_settings` to honor `max_applies_per_day` remaining today → effective target = `min(N, remaining)`.
   - Lists enabled `sources` for the user, ordered hot → warm → apify (matches existing tier ordering).
   - POSTs to the worker route `/api/public/sources/run-batch` with `{ userId, target }` and an internal-secret header.
4. The new worker route loops sources sequentially, calling Python `run_source_by_key(key, match_limit=remaining)` (already exists in `worker/app/sources/registry.py`). After each source, decrements `remaining`; stops at 0 or when sources exhausted.
5. As matched jobs are inserted, the existing `auto_queue_matched_job` DB trigger creates `applications` rows in `queued` state (only when `automation_settings.enabled = true`).
6. The existing `apply-worker-every-minute` pg_cron job drains the queue and submits them. Nothing else to wire.

## Files

**New**
- `src/routes/api/public/sources/run-batch.ts` — public route. Validates `x-internal-secret` against `WORKER_CRON_SECRET`. Body: `{ userId: uuid, target: 1..50 }`. Uses `supabaseAdmin` to list enabled sources (ordered by kind: hot→warm→apify), then forwards `match_limit` per source to the worker process via the same mechanism used by `run-tier.ts`. Returns `{ inserted, perSource: [{key, inserted}] }`.

**Edited**
- `src/lib/applications.functions.ts` — add `runOneShotBatch` server fn (`requireSupabaseAuth`), Zod-validated `{ target?: number }`, default 10. Computes remaining daily quota, calls the public batch route via `fetch` with internal secret, returns summary. Logs to `logs` table via existing pattern.
- `src/routes/_authenticated/jobs.tsx` — header action: a dropdown/number input (default 10) + **Run batch** button. Disabled while in-flight. On success: toast `"Inserted X matched jobs — apply worker will submit them"` + `queryClient.invalidateQueries(['jobs'])` and `['applications']`. On error: toast error.
- `src/routes/_authenticated/applications.tsx` — mirror the same button above the kanban so user can trigger from either page.
- `worker/app/sources/registry.py` — small helper `run_batch_until(target, source_keys)` that iterates keys and calls `run_source_by_key(k, match_limit=remaining)` decrementing `remaining`. Returns `{inserted, perSource}`. (Existing `match_limit` plumbing already supported.)
- `src/routes/api/public/sources/run-tier.ts` — no change needed; new batch route is a sibling.

## Guardrails

- **Auth**: server fn requires session; public worker route requires `x-internal-secret == process.env.WORKER_CRON_SECRET` (existing pattern).
- **Quota**: target is clamped to remaining daily apply quota so the worker doesn't scrape jobs that can't be queued today.
- **Idempotency**: existing `dedupe_hash` on jobs + `auto_queue_matched_job` skip-if-exists logic prevent duplicates if the user clicks twice.
- **Automation enabled check**: server fn returns a clear error if `automation_settings.enabled = false` (since `auto_queue_matched_job` is a no-op then). UI shows: "Enable Automation in Settings first."
- **Input validation**: Zod `target: z.number().int().min(1).max(50)`.
- **No new tables, no schema changes, no RLS edits, no cron changes.**

## Out of scope

- Pausing source cadence permanently (this is one-shot only; scheduled runs continue on their own).
- Progress streaming (the call is synchronous and returns once the worker loop finishes; for N=10 across hot sources this is typically <60s).
- Worker-side per-source parallelism changes.

Approve to build.
