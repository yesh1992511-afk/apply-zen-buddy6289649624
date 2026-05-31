
# Goal

Fully automated cybersecurity job hunt: scrape every enabled source continuously, score/filter each job the moment it lands, auto-queue matches for apply, and have the worker apply smoothly 24/7 with extra throughput during US peak posting hours. Zero manual clicks after setup.

---

## 1. Lock the cybersecurity targeting (one-time, automatic)

Pre-fill `automation_settings` for cybersecurity so every new job is scored against the right intent:

- `target_titles`: security engineer, cybersecurity engineer, SOC analyst, application security, cloud security, security architect, penetration tester, red team, blue team, incident response, DFIR, GRC, IAM, detection engineer, threat intel, security operations, vulnerability management, devsecops, security consultant
- `target_exclude_keywords`: physical security, security guard, security officer, loss prevention, armed
- `target_country`: US (already set)
- `target_posted_within_hours`: 72 (fresh jobs only)
- Create a default filter "Cybersecurity – All Domains" with `min_score = 55`, broad keyword set, exclude non-tech security terms — and set it as `active_filter_id`.

User can tweak later, but defaults work out of the box.

## 2. Auto-queue matches the instant they land

Add a Postgres trigger on `public.jobs`:

- After `match_job_to_filters` updates a job to `status='matched'` AND `score >= active_filter.min_score`, automatically `INSERT INTO applications (user_id, job_id, status='queued', phase='discovered')` if not already queued.
- Respects the existing `enforce_apply_quota` trigger (plan limits still apply).
- Idempotent via a unique `(user_id, job_id)` partial index on non-terminal applications.

Result: scrape finishes → job scored → if it matches → application row queued in the same DB transaction. No polling, no UI step.

## 3. Continuous scrape loop (smooth, not bursty)

Worker side (`worker/app/main.py` scheduler):

- Replace "run all at once" with a **rolling scheduler**: each source has `cadence_minutes`; the loop wakes every 60s and runs only sources whose `last_run_at + cadence` has passed.
- Stagger by source tier so we never hammer one provider:
  - Free RSS/JSON (RemoteOK, Remotive, Arbeitnow, WeWorkRemotely, HN, infosec-jobs, cybersecjobs, clearedjobs): every 15 min
  - ATS boards (Greenhouse, Lever, Ashby, Workable, SmartRecruiters, Recruitee, Teamtailor, BambooHR, Personio, Breezy, Jobvite, iCIMS, Workday): every 30 min
  - USAJobs: every 30 min
  - Apify (LinkedIn, Indeed, Glassdoor, Wellfound, ZipRecruiter, Google Jobs): every 60 min (cost control)
- Per-source concurrency cap = `automation_settings.parallelism` (default 2) so the worker stays responsive.
- Each source run writes `automation_runs` + updates `sources.last_run_*` so the UI health badges stay live.

## 4. Peak-hour boost (US posting windows)

Most US tech jobs post Tue–Thu, 9 AM–12 PM ET, with a secondary bump 2–4 PM ET.

Add a "peak window" multiplier in the scheduler:

- Mon–Fri 13:00–20:00 UTC (≈ 9 AM–4 PM ET): halve every cadence (e.g. Apify 60→30 min, ATS 30→15 min).
- Off-peak / weekends: normal cadence.
- Respect `automation_settings.daily_start`/`daily_end` and `run_24_7` — if user sets a window, peak boost only applies inside it.

This gives you maximum freshness when employers actually post, without burning Apify credits at 3 AM.

## 5. Smooth auto-apply worker

Apply runner (`worker/app/apply/runner.py`):

- Pull from `applications WHERE status='queued' ORDER BY queued_at` in batches of `parallelism`.
- Per-portal rate limit (already in `worker/app/apply/ratelimit.py`) — keep LinkedIn/Indeed light to avoid bans.
- Humanized delays (already in `humanize.py`) tied to `aggressiveness` setting.
- Retry policy: on transient failure (network, captcha solve timeout) → `next_retry_at = now + exponential backoff`, `retry_count++`, cap at 3 retries before DLQ (`dlq_reason` set).
- On hard failure (no apply button, login wall, account locked) → status `needs_review`, surface in `/applications` for manual triage.
- Daily cap from `max_applies_per_day` enforced by existing trigger.

## 6. Health & visibility (no new UI work needed)

- `/sources` already shows per-source health, last run, error — keep it.
- `/applications` already shows queue/in-progress/applied/failed — keep it.
- Add one new card on `/dashboard`: "Pipeline last 24h" — scraped, matched, queued, applied, failed (single SQL view).
- Worker heartbeat already exists; daily summary email already wired.

## 7. What I need from you

**Nothing.** All required secrets are set:

- `APIFY_TOKEN` ✅ (LinkedIn, Indeed, Glassdoor, Wellfound, ZipRecruiter, Google Jobs)
- `USAJOBS_API_KEY` ✅
- `DECODO_*` proxy ✅ (anti-bot for apply portals)
- `CAPSOLVER_API_KEY` ✅ (captcha during apply)
- `APPLY_EMAIL` / `APPLY_PASSWORD` / `APPLY_DEFAULT_PHONE` ✅
- `GMAIL_*` ✅ (OTP retrieval during apply)
- `OPENAI_API_KEY` / `DEEPSEEK_API_KEY` ✅ (resume tailoring + cover letters)

Free sources (RemoteOK, Remotive, Arbeitnow, WWR, HN, infosec-jobs, cybersecjobs, clearedjobs, all ATS boards) need no keys.

Optional later: LinkedIn/Indeed session cookies via the Chrome extension for higher Apify success rates — but not required to start.

---

## Technical details

### Files to change
- `supabase/migrations/*` — new trigger `auto_queue_matched_jobs`, unique partial index on applications, seed cybersecurity defaults via server fn on first run (not migration, since user-specific).
- `src/lib/sources/curated-packs.ts` — add "Cybersecurity Top 100" company pack (Crowdstrike, Palo Alto, Wiz, SentinelOne, Zscaler, Snyk, Datadog security, Cloudflare, Okta, 1Password, HashiCorp, Tenable, Rapid7, Mandiant, Recorded Future, Arctic Wolf, etc.).
- `src/lib/sources/setup-cybersec.functions.ts` (new) — one-shot server fn called from `/sources` "Wire everything" button that seeds targeting + filter + applies the cybersec pack.
- `worker/app/main.py` — rolling scheduler with tier cadences + peak-hour multiplier.
- `worker/app/apply/runner.py` — batch puller + retry/backoff + DLQ + needs_review path.
- `src/routes/_authenticated/dashboard.tsx` — add "Pipeline last 24h" tile.

### No new dependencies, no new secrets, no new edge functions.

### Verification after build
1. Run `setup-cybersec` once → confirm filter + targeting in DB.
2. Trigger one scrape cycle → confirm new `jobs` rows + matched ones auto-create `applications` rows.
3. Watch `/applications` → confirm worker picks them up and applies (screenshots in storage).
4. Check `/sources` 1h later → all green or with informative `last_error`.
