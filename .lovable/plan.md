# Plan: Worker DLQ Patch + System Polish

## 1. Worker patch (applied on your VPS, not in this repo)

Deliver a single unified diff (`worker_dlq.patch`) you can `git apply` on the VPS. It adds:

- **Retry budget**: read `attempts` and `max_attempts` (default 4) from `applications`. On failure, increment `attempts`, set `next_retry_at = now() + backoff(attempts)` (exponential: 5m, 15m, 1h, 4h). When `attempts >= max_attempts`, set `phase = 'dead_letter'`, `status = 'failed'`, write final error to `last_error`.
- **Retry gating**: the apply-loop query filters `WHERE phase IN ('queued','retry') AND (next_retry_at IS NULL OR next_retry_at <= now())`. Rows in `dead_letter` are skipped.
- **Manual retry support**: when the UI flips a row back to `phase='queued'` and clears `next_retry_at`, the worker picks it up on the next tick — no code change needed beyond the gating query.
- **Event log**: every attempt writes an `application_events` row (`attempt_started`, `attempt_failed`, `dead_lettered`) with `error_code`, `screenshot_path`, `duration_ms`.
- **Heartbeat**: keep existing heartbeat, add `last_error` field so the worker page surfaces the most recent crash without log-diving.

Output: the patch text in chat + a short "how to apply" block (`git apply worker_dlq.patch && systemctl restart applyzen-worker`).

## 2. Repo changes to make the patch land cleanly

### Migration
- Add columns if missing: `applications.attempts int default 0`, `max_attempts int default 4`, `next_retry_at timestamptz`, `last_error text`.
- Create `application_events` table (`id, application_id, user_id, kind, message, error_code, screenshot_path, duration_ms, created_at`) with RLS scoped to `auth.uid()`, GRANTs for authenticated + service_role, index on `(application_id, created_at desc)`.
- Index `applications (phase, next_retry_at)` for the worker query.

### Server functions (`src/lib/applications.functions.ts`)
- `retryApplication(id)` — set `phase='queued'`, `attempts=0`, `next_retry_at=null`, clear `last_error`.
- `discardApplication(id)` — set `phase='dead_letter'`, `status='discarded'`.
- `listApplicationEvents(applicationId)` — returns timeline.

### UI
- `/applications` — add a **Needs review** tab filtering `phase='dead_letter'` with bulk Retry/Discard.
- `/applications/$id` — add an **Events timeline** panel (attempt count, last error, screenshot thumbnails via signed URL).

## 3. Phase B — Setup checklist polish

Expand `getSystemReadiness()` to check: profile completeness ≥ 80%, default resume exists, ≥1 cover letter, Gmail secret, captcha secret, proxy secret, worker heartbeat < 10min, ≥1 source enabled, ≥1 filter, automation target set. Rebuild `/setup` as a red/amber/green list with deep-links to the exact fix page. Dashboard banner already wired — just feed it the richer signal.

## 4. Phase E — Notifications cron (skeleton only)

- New route `src/routes/api/public/hooks/notifications-tick.ts` (POST, runs every 5 min via `pg_cron`).
- Fires Gmail SMTP via existing Gmail secret for: worker offline > 15min, ≥3 failed applies in last hour, new job with score ≥ 85, daily 8am summary.
- Per-user opt-in flags on `notification_settings` (already exists). No new secrets needed.
- `pg_cron` schedule added via `supabase--insert` (not migration, since URL is project-specific).

## 5. Out of scope

Python worker source in this repo, browser extension, billing, new scrapers, AI model swaps.

## Deliverables

1. `worker_dlq.patch` posted in chat with apply instructions.
2. One migration (cols + `application_events` + indexes).
3. Updated `applications.functions.ts` + `applications.tsx` + `applications.$id.tsx`.
4. Expanded `readiness.functions.ts` + rebuilt `/setup`.
5. New `notifications-tick` route + cron registration.

Ship order: migration → worker patch → UI → readiness → notifications. Each step is independently useful if you stop early.
