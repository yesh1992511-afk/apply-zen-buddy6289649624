# System hardening: 4 tracks

You picked all four focus areas at scope 5. I'll ship them in one go but as **independent, mergeable tracks** so each one stands on its own. Order = highest leverage first.

## Current state (snapshot)

- 20 sources enabled, 1 filter, 3 resumes, automation **off**, **0 secrets set** (captcha/proxy/Gmail), worker last seen 4 days ago.
- That means even with the cybersecurity target applied, the next run will scrape but **cannot auto-apply** (no creds), and you won't be alerted when it stalls.

So the order below isn't cosmetic — it follows what's actually blocking the system from being "perfect" for you.

---

## Track 1 — Setup completeness (unblocks everything)

Goal: stop silent failures from missing config.

- **`/setup` becomes a checklist page** with green/amber/red rows, each linking to where to fix it:
  - Profile completeness (≥ 90% of fields the apply walker reads)
  - Resume: at least one default + LaTeX parses
  - Gmail credentials verified (`gmail_credentials.verified_at` not null)
  - Captcha key set + 2captcha balance ping
  - Proxy provider set (optional, only flagged amber)
  - Worker heartbeat seen in last 5 min
  - Job Target applied (titles/locations not empty)
  - At least 1 enabled source, 1 saved filter
- **Dashboard banner** when any red item exists ("Auto-apply is paused: missing Gmail credentials").
- **Server fn `getSystemReadiness()`** returns the structured checklist — reused by dashboard banner, sidebar dot, and `/setup`.

## Track 2 — Job quality (relevance > volume)

Goal: only see jobs that actually match you.

- **Per-source keyword injection audit**: I'll log per scraper what query it actually sent vs the Job Target. Add a small "Last query" line under each source row on `/sources` so you can see e.g. RemoteOK was searched with `tags=security,cybersecurity`.
- **Smarter scoring** (rewrite `match_job_to_filters`):
  - Title-match weight (cyber keyword **in title** = +25, in body = +5)
  - Hard exclude on negative title patterns (`sales`, `physical security`, `guard`, `marketing`, etc. configurable from Job Target)
  - Country/location enforcement (US-only when target_country='US')
  - Seniority match against profile years_experience
  - Cap score 0–100, persist component breakdown to `jobs.raw->'score_breakdown'` so you can see *why*
- **Better dedup**: include normalized company + title in `dedupe_hash` to kill cross-source duplicates (RemoteOK + Indeed posting same role).
- **"Re-score all jobs" button** on `/filters` — runs match function over existing rows.

## Track 3 — Apply pipeline reliability

Goal: failures are visible, retried, and recoverable.

- **Retry policy in worker**: exponential backoff (1m, 5m, 30m, 2h) up to 4 attempts using existing `applications.retry_count` / `next_retry_at` columns. After max attempts → `phase='dead_letter'`, `dlq_reason` populated.
- **DLQ tab on `/applications`**: filter chip "Needs review" showing dead-lettered rows with one-click **Retry** / **Discard** / **Open job**.
- **Per-application timeline upgrade** (`/applications/$id`): show every `application_events` row with phase, status, screenshot thumbnail, and the error message inline (today errors are buried in logs).
- **Idempotency**: enforce unique `idempotency_key` (already a column, no unique index) so a double-click can't queue twice. Add `UNIQUE (user_id, job_id) WHERE phase != 'dead_letter'` partial index.

## Track 4 — Worker observability

Goal: know at a glance what the worker is doing without reading docker logs.

- **`/worker` page becomes a live console**:
  - Heartbeat status (green if `last_seen` < 30s, amber < 5m, red older), version, container metadata
  - Last 20 `automation_runs` with status, items_in/out, errors, duration
  - Live tail of `logs` table for current user (last 50, auto-refresh every 3s via realtime channel)
  - Per-source health: cadence vs last_run_at, last_run_status, last_error truncated
- **Notifications wiring** (table already exists, just unused):
  - Worker offline > 10 min → email via existing `notification_settings.notify_worker_offline`
  - Apply failed after max retries → email
  - High-score (≥ threshold) match → email
  - Daily summary at user's `daily_summary_time`
  - All sent through a new cron route `/api/public/hooks/notifications-tick` (every 5 min) using `supabaseAdmin`.

---

## Technical scope (for reference)

- **DB migration**: partial unique index on applications; index on `jobs(user_id, matched, score)`; new column `jobs.score_breakdown jsonb`; rewrite `match_job_to_filters()` SQL function.
- **New server fns** (`src/lib/`): `readiness.functions.ts`, `rescore.functions.ts`, `applications.functions.ts` (retry/discard).
- **New route**: `src/routes/api/public/hooks/notifications-tick.ts` + pg_cron schedule (5 min).
- **Worker changes** (`worker/app/`): retry scheduler in `commands.py`, structured error capture in `apply/runner.py`, per-source query logging in `sources/base.py`.
- **UI**: rebuild `/setup`, `/worker`, `/applications/$id`; add DLQ tab to `/applications`; per-source "Last query" line + "Re-score" button.

## Out of scope (this round)

- New scrapers / new portals
- AI cover letter quality tuning
- Browser extension changes
- Billing/Stripe work

---

## Suggested rollout order

1. **DB migration + scoring rewrite** (Track 2 core) — biggest immediate quality lift
2. **Readiness + setup checklist** (Track 1) — unblocks auto-apply
3. **Worker page + notifications cron** (Track 4) — visibility
4. **Retry/DLQ + timeline** (Track 3) — needs worker changes

Want me to proceed with all four, or trim? If trim, easiest cut is Track 3 (needs worker docker changes you'd have to rebuild locally).