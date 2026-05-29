# Gmail Integration: OTP Auto-Fill + Smart Notifications

## What this does

1. **OTP auto-fill** — During an apply, when a portal sends a verification email, the worker polls your Gmail, extracts the 6-digit code, and types it into the form. No manual interruption.
2. **Manual review alerts** — Instant email when captcha/2FA/odd question blocks the bot.
3. **High-score job alerts** — Instant email when a 95+ score job is scraped (so you can review before auto-apply).
4. **Apply failed alerts** — Email after retries exhausted on a job.
5. **Worker offline alert** — Email if heartbeat is stale >10 min.
6. **Daily summary** — Once a day: jobs scraped, applied, failed, manual-review pending, top 5 matches.

## Step 1 — Connect Gmail (one click, you only)

Trigger the Gmail connector. You sign in once and grant: `gmail.readonly` (read OTPs) + `gmail.send` (send notifications). Credentials live in the connector gateway — no API keys to manage.

## Step 2 — OTP reader server function

`src/lib/gmail.functions.ts` → `fetchOtpCode({ portalDomain, sinceIso })`:
- Calls `users/me/messages?q=from:<portalDomain> newer_than:5m is:unread`
- Fetches latest message body, regex `/\b(\d{4,8})\b/` near keywords (code, verification, OTP, verify)
- Returns `{ code, messageId }` or `null`
- Marks message read after extraction

Worker integration in `worker/app/apply/browser.py`:
- New `wait_for_otp(portal_host, timeout=120s)` helper polls the server function every 5s
- Called from each portal adapter (`indeed.py`, `lever.py`, `workday.py`) when an OTP input is detected
- Falls back to manual review if no code arrives in time

## Step 3 — Notification dispatcher

`src/lib/notify.functions.ts` → `sendNotification({ kind, subject, body, jobId? })`:
- Builds RFC 2822 email, base64url, POSTs to `users/me/messages/send`
- Logs to `usage_events` (kind=`email_sent`)
- Honors `notification_settings` toggles (skip if disabled)

**New table `notification_settings`** (one row per user):
- `daily_summary_enabled` bool, `daily_summary_time` time (default 20:00)
- `notify_manual_review` bool default true
- `notify_high_score` bool default true, `high_score_threshold` int default 95
- `notify_apply_failed` bool default true
- `notify_worker_offline` bool default true
- `recipient_email` text (defaults to profile.email)

Triggered from:
- **Worker** (`apply/runner.py`): on manual-review state, on final fail → enqueues a `notify` worker_command, server function picks it up and sends via Gmail
- **Worker** (`commands.py` scrape consumer): on job with score≥threshold → enqueue notify
- **pg_cron** (every 5 min): checks `worker_heartbeat.last_seen` — if stale >10 min, calls a `/api/public/hooks/check-heartbeat` route that sends offline alert (debounced 1×/hour)
- **pg_cron** (hourly): checks if any user's daily-summary time has passed in their timezone today and not yet sent — calls `/api/public/hooks/daily-summary` which aggregates jobs/applications from last 24h and emails

## Step 4 — UI: Notifications settings page

New route `src/routes/_authenticated/notifications.tsx`:
- Toggles for each event type
- Time picker for daily summary
- "Send test email" button (uses Gmail connector)
- Recent sent-notifications list (last 20 from `usage_events`)
- Sidebar link in nav

## Step 5 — Wire everything

- Migration: `notification_settings` table + RLS + grants, seed row in `handle_new_user()`
- `start.ts`: ensure `attachSupabaseAuth` is in `functionMiddleware` (likely already there)
- Worker bumps version, deploys via existing `scp + bootstrap.sh`
- pg_cron jobs use stable URL `project--ba5780a8-641e-4ee8-9c24-6e1c185cef2f.lovable.app`

## Files

**New:**
- `src/lib/gmail.functions.ts` (fetchOtpCode, sendGmail helper)
- `src/lib/notify.functions.ts` (sendNotification, getNotificationSettings)
- `src/routes/_authenticated/notifications.tsx`
- `src/routes/api/public/hooks/check-heartbeat.ts`
- `src/routes/api/public/hooks/daily-summary.ts`
- `worker/app/notify.py` (enqueue helper)
- Migration: `notification_settings` table + cron jobs

**Edited:**
- `worker/app/apply/browser.py` (wait_for_otp polling)
- `worker/app/apply/portals/{indeed,lever,workday}.py` (call wait_for_otp on OTP fields)
- `worker/app/apply/runner.py` (emit notify events on manual-review / final fail)
- `worker/app/commands.py` (emit notify on high-score scrape)
- `src/components/AppSidebar.tsx` (add Notifications link)

## Order of execution

1. Trigger Gmail connector → you click through OAuth
2. Migration (table + cron) — await your approval
3. Server functions + UI
4. Worker code + redeploy
5. End-to-end test: trigger a fake OTP email to yourself, verify worker reads it; trigger a fake high-score job, verify alert arrives

Approve and I'll start with the Gmail connector flow.
