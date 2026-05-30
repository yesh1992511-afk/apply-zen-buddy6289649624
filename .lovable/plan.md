# Finish JobPilot: remaining gaps + phases

## Phase A — Close gaps from the Gmail/notifications work just shipped

These items were referenced but not fully wired in the last batch.

1. **Worker command handlers for notifications**
   - `worker/app/commands.py`: add handlers for the new command kinds the cron hooks enqueue:
     - `notify_offline` → call `gmail.send_and_log("worker_offline", ...)` with last_seen from payload.
     - `notify_daily_summary` → query last 24h: jobs scraped, jobs matched, applications queued/applied/failed, top 5 by score, manual-review count. Send a single summary email.
   - Without this, the cron hooks enqueue commands that the worker never executes.

2. **OTP wiring in portal adapters**
   - `worker/app/apply/gmail_otp.py` exists; confirm `wait_for_otp(portal_host)` is the public helper.
   - `indeed.py`, `linkedin.py`, `workday.py`, `lever.py`: detect OTP/2FA input fields (`input[type=tel]`, `input[name*=code]`, `input[autocomplete=one-time-code]`) and call the helper before falling back to manual review.
   - Falls back to `notify.manual_review(...)` after timeout (60–120s).

3. **pg_cron registration**
   - The two hook routes exist (`check-heartbeat`, `daily-summary`) but the cron jobs that call them must be registered.
   - Use `supabase--insert` (not migration) to schedule:
     - `*/5 * * * *` → POST `/api/public/hooks/check-heartbeat`
     - `*/15 * * * *` → POST `/api/public/hooks/daily-summary`
   - Both with `apikey: <anon>` header, empty `{}` body.

4. **Recipient fallback**
   - `worker/app/notify.py`: when `recipient_email` is empty, fall back to `gmail_credentials.email` (the user's own Gmail) instead of failing silently.

5. **`notification_log` retention**
   - Keep only last 200 rows per user (worker cleanup at end of daily summary), so the "Recent notifications" card stays useful.

## Phase B — Remaining JobPilot phases (post-Gmail)

These are the broader pieces still needed to run the bot autonomously end-to-end.

### B1. Apify source credentials & connection test
- `/sources` page: per Apify source (`apify_linkedin`, `apify_indeed`, `apify_glassdoor`, etc.), surface a "Test fetch" button that runs a single small fetch and reports count + errors. Right now the user has no way to validate a source is configured correctly without waiting for cron.

### B2. Resume + cover-letter quick-check
- `/profile` already has resume upload. Add a "Preview tailored output" panel that takes one job from `jobs` (highest score) and renders:
  - LaTeX→PDF preview of tailored resume.
  - AI-generated cover letter draft.
- Lets the user verify AI tone before bot starts applying.

### B3. Dashboard upgrade
- Replace current dashboard with live counters: scraped 24h, matched, queued, applied today vs. `max_applies_per_day` budget, worker heartbeat freshness, last 10 events feed.

### B4. Kill-switch + safety
- Global "Pause automation" toggle on dashboard (sets `automation_settings.enabled=false`) — already exists in DB; just needs a prominent button.
- Per-portal rate-limit display ("Indeed: 4/10 last hour").

### B5. Worker deployment
- Bundle: `scp -r worker root@147.93.47.24:/root/jobpilot/ && ssh root@147.93.47.24 'cd /root/jobpilot/worker && docker compose build && docker compose up -d'`
- Add `worker/VERSION` bump so heartbeat shows it.

### B6. End-to-end smoke test
- Manual checklist run after deploy:
  1. Save Gmail App Password → click "Send test" → email arrives.
  2. Enable one Apify source → wait one cycle → jobs appear.
  3. Plant a fake high-score job (SQL update score=99) → notification email arrives.
  4. Disable network on worker for 15 min → offline alert email arrives.
  5. Wait until `daily_summary_time` → summary email arrives with non-zero counts.

## Order of execution

1. Phase A1 (worker command handlers) — without it, A3 cron is dead weight.
2. Phase A2 (OTP wiring polish) + A4/A5.
3. Phase A3 (register cron jobs via supabase--insert).
4. Phase B1 (source test button) → B2 (preview) → B3 (dashboard) → B4 (kill-switch).
5. Phase B5 (deploy) → B6 (smoke test).

## Technical notes

- All new server fns continue to use `requireSupabaseAuth`; cron hooks remain under `/api/public/*`.
- No new secrets needed — Gmail App Password already covers send + read.
- Worker writes its handler results into `worker_commands.result` so the UI can show "✓ summary sent at 20:01".
- No schema changes required beyond what already shipped.

## What I need from you

Just **Approve** and pick one:
- **(a) Do everything A→B in one go** (will take several batched edits + one deploy).
- **(b) Do Phase A only now**, then we test, then I tackle Phase B.

I recommend (b) — verify notifications work end-to-end before stacking dashboard work on top.
