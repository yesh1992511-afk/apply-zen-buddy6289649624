
# JobPilot — Coverage, Cost & Remaining Work Audit

Scope: solo user, aggressive automation (≈50 applies/day, parallelism 2, 24/7), US market.

---

## 1. Portal coverage — where we stand vs. US max

### A. Scraping (`worker/app/sources/`) — what's wired today

| Tier | Portals wired | Status |
|---|---|---|
| Apify (paid) | LinkedIn (bebity + curious_coder), Indeed (misceres + generic), Glassdoor, ZipRecruiter, Google Jobs, Wellfound | ✅ ready |
| Free APIs | RemoteOK, We Work Remotely, Arbeitnow, Remotive, Work At A Startup | ✅ ready |
| ATS boards (free) | Greenhouse, Lever | ✅ ready |
| Extension (user-side) | LinkedIn, Indeed, Glassdoor, Dice, ZipRecruiter, Wellfound | ✅ content scripts exist |

**Coverage estimate vs. realistic US job-source universe: ~75–80%.**

Missing scrapers worth adding (high-volume US-relevant):

1. **Dice** server-side adapter (have extension only) — strong for US tech
2. **BuiltIn** (built-in.com) — strong for US tech startups/enterprise
3. **Workday public boards** (HCM career sites) — huge enterprise volume
4. **Ashby boards** — fast-growing modern ATS, free JSON API
5. **SmartRecruiters** public job API — free
6. **Workable** public boards — free
7. **USAJobs** API — federal, completely free, official
8. **Monster / CareerBuilder / SimplyHired** — declining but still volume; Apify actors exist
9. **AngelList / Wellfound talent feed** (we have Wellfound jobs only)
10. **YC Work At A Startup** company-specific endpoints (have aggregate)

### B. Auto-apply portals (`worker/app/apply/portals/`)

| Portal | Status | Expected success rate* |
|---|---|---|
| LinkedIn Easy Apply | ✅ | 55–70% |
| Indeed Easy Apply | ✅ | 50–65% |
| Greenhouse | ✅ | 75–85% |
| Lever | ✅ | 75–85% |
| Workday | ✅ | 40–55% (notoriously brittle) |

\*on jobs where the adapter is correctly matched; the rest fall to manual review.

**Coverage of US auto-apply traffic: ~70%** (LinkedIn + Indeed + Greenhouse + Lever + Workday cover the long tail of postings, but not every ATS).

Missing apply adapters (ranked by US volume):
1. **Ashby** — modern, structured forms, high success rate achievable
2. **SmartRecruiters** — common at mid-market US employers
3. **Workable** — common at SMB
4. **iCIMS** — large enterprise, harder (older UI)
5. **Taleo** (Oracle) — large enterprise, hardest
6. **BambooHR / JazzHR / Recruitee / Teamtailor** — SMB long tail

**Expected end-to-end realistic success on 50 queued/day (current state)**: 28–35 truly submitted, 8–15 manual-review, rest fail/skipped. **~55–70% applied rate.** Adding Ashby + SmartRecruiters + Workable would push this to **~75–82%**.

---

## 2. Observability coverage — what's instrumented

| Layer | Coverage | Gaps |
|---|---|---|
| Worker → `logs` table via `db_log()` | ~85% | Some `try/except` swallow without `db_log` (browser.py, captcha.py, gmail_otp.py) |
| Worker → `automation_runs` per scrape/apply | ✅ 100% | – |
| Worker → `worker_heartbeat` every loop | ✅ | – |
| Frontend errors → `ErrorBoundaryRoute` | ✅ all authed routes | No central client-error sink (Sentry-like) — `error-capture.ts` exists but unused |
| Server functions (`createServerFn`) | ⚠️ partial | No structured logging wrapper; ad-hoc `console.error` |
| Public API routes (`/api/public/hooks/*`) | ⚠️ | Webhook handlers don't log to `logs` table on failure |
| Extension (`extension/`) | ❌ | No remote logging; user-side errors invisible |
| Cost tracking (`usage_events`) | ❌ unused table | Schema exists, no producers anywhere |

**Overall observability: ~70%.** The biggest blind spots are usage/cost telemetry, extension errors, and server-function failures.

---

## 3. Monthly cost — realistic for 50/day aggressive solo user

| Provider | What it pays for | Estimate |
|---|---|---|
| **Lovable Cloud (Supabase)** | DB rows (~50k jobs/mo, ~1.5k apps, ~30k logs), storage (resumes ~150MB), bandwidth, edge fn calls | **$0** on free tier likely; **~$25** if you exceed 500MB DB or 1GB storage |
| **Apify** | LinkedIn + Indeed + Glassdoor + ZipRecruiter scraping, runs hourly | **$15–35** (starter $5/mo + per-result) |
| **Residential proxies (IPRoyal)** | Apply flows on LinkedIn / Workday only (~10GB/mo realistic) | **$15–25** |
| **Captcha (2captcha)** | ~10–30 challenges/day → ~600/mo | **$2–3** |
| **VPS for worker** (Hetzner CPX21 / DO 2GB) | Always-on Python + Playwright | **$8–12** |
| **OpenAI gpt-4o-mini** | Resume tailoring (~4K tokens × 1.5k applies = ~6M tok/mo) | **$2–4** |
| **DeepSeek** | JD reasoning + cover letters | **$3–6** |
| **Lovable AI Gateway** | Currently unused in app code | **$0** |
| **Gmail OAuth / SMTP** | OTP reads + notifications | **$0** |
| | | |
| **TOTAL realistic** | | **~$45–110 / month** |
| **Heavy month (Workday-heavy + lots of captcha)** | | **~$130–160** |

The two variable items are **Apify** (per-result pricing) and **proxies** (per-GB). Everything else is essentially fixed.

---

## 4. Where we can save *right now* (no functionality loss)

Ranked by $ saved / effort:

1. **Route AI by tier (highest ROI)** — `automation_settings` already has `ai_resume_model` defaulting to `openai/gpt-5`. Switch tailoring default to `gpt-4o-mini` and reserve `gpt-5` for cover letters on score ≥ 90. **Saves 80–90% of AI spend** (potentially $30–50/mo if gpt-5 was actually used).
2. **Cache JD reasoning by `dedupe_hash`** — same JD re-analyzed across users/runs today. Adding a `jd_analysis` cache keyed by `dedupe_hash` cuts DeepSeek calls ~40%. **~$2/mo + lower latency.**
3. **Skip proxy for free-API sources** — `remoteok`, `arbeitnow`, `remotive`, `weworkremotely`, `greenhouse`, `lever`, `workday` public boards don't need residential proxies. `worker/app/apply/proxy.py` is used unconditionally; gate by portal. **Saves ~30–50% proxy GB → $7–12/mo.**
4. **Cadence-tune sources** — `cadence_minutes` defaults to 60 for every source. Boards that post 1–2 jobs/day (small Greenhouse companies) can run every 6–12 hr. **Cuts Apify results 30–40% → $5–10/mo.**
5. **Filter BEFORE Apify pagination** — current normalize → filter happens after Apify returns. Push `keywords` + `locations` into the Apify input query so we pay for fewer results. **Cuts Apify spend ~25%.**
6. **Move OTP read to IMAP, not Gmail API** — `gmail_credentials` table already has IMAP host/port; switch off the OAuth dependency and one less moving part / token rotation cost. (Operational saving, not $.)
7. **Auto-purge `logs` older than 30 days** — table grows fast; add a cron `delete from logs where ts < now() - interval '30 days'`. Keeps Supabase DB under free tier.
8. **Compress `jobs.raw` jsonb** or stop storing it after normalize succeeds. Single biggest row-size contributor.
9. **Reuse browser context across applies on same portal** — currently `new_browser()` per apply. Pooling saves 2–4s/apply and ~20% proxy bandwidth.
10. **Set Apify `maxItems` per run from `cadence_minutes`** — currently unbounded, occasionally returns 500+ items we throw away.

**Realistic total monthly savings if all applied: ~$25–60/mo** (i.e. cut bill roughly in half).

---

## 5. Remaining implementations (everything outstanding)

### A. Frontend / UX (small remaining from Awwwards plan)
- Applications: status-pipeline header strip, per-row timeline popover, screenshot lightbox (Dialog)
- Sources: per-source `Sparkline` from `automation_runs` (component exists, not wired)
- Setup: vertical stepper with SVG completion ring + "resume from last incomplete step"
- Profile: Tabs split (Basics / Resume / Preferences / Connected accounts)
- Automation: full Idle→Starting→Running→Stopping state machine (save-button done; primary control not)
- Logs: virtualised list (no new dep — windowing via scroll math)
- Notifications: channel toggles as switch rows (digest preview shipped)
- a11y final pass: single `<main>` landmark, focus-visible audit, `prefers-reduced-motion` verification, toast `tabular-nums`

### B. Server / Lovable Cloud
- **`usage_events` producers** — write a row per AI call, per Apify run, per proxy session, per apply. Unlocks a cost dashboard.
- **Cost dashboard page** — month-to-date spend tile + per-provider sparkline (consumes `usage_events`)
- **`logs` retention cron** (`/api/public/hooks/purge-logs`)
- **JD-analysis cache table** (savings item #2 above)
- Webhook signature verification audit on `apply-worker`, `check-heartbeat`, `daily-summary`, `ingest-extension`, `run-tier`
- Structured logger wrapper for all `createServerFn` handlers → `logs` table
- Centralised client-error sink (wire existing `error-capture.ts`)

### C. Worker (`worker/app/`)
- **New scrapers**: Ashby, SmartRecruiters, Workable, USAJobs, BuiltIn, Workday public boards, Dice (server)
- **New apply adapters**: Ashby, SmartRecruiters, Workable, iCIMS (Taleo lowest priority)
- Browser context pool (savings item #9)
- Per-portal cadence + `maxItems` tuning (#4, #10)
- Push filters into Apify query (#5)
- Conditional proxy by portal (#3)
- AI tier routing in `tailor.py` + `cover_letter.py` (#1)
- IMAP fallback for OTP (#6)
- Daily resume regeneration skip when JD hash unchanged
- Per-portal stats rollup → feeds the new cost dashboard

### D. Extension
- Remote error logging (token-authed POST to `/api/public/hooks/ingest-extension-error`)
- Per-day capture cap surfacing in popup (`extension_tokens.captures_today` already tracked)
- Auto-update check (manifest version vs. published)

### E. Notifications
- Channel toggles UI ↔ `notification_settings` columns (already in schema)
- Push channel (web-push via service worker)
- Slack/Discord webhook channel (env already has `ALERT_WEBHOOK_URL`)

---

## 6. Recommended next sprint (1 build session)

If I had to pick the **highest-leverage 90 min** of build work to ship next, in order:

1. AI tier routing (cost win, 15 min)
2. Conditional proxy gating (cost win, 10 min)
3. Logs retention cron + JD cache table (cost + reliability, 20 min)
4. `usage_events` producers + cost tile on Dashboard (visibility, 30 min)
5. Ashby scraper + apply adapter (coverage win, parallel — 60 min if done separately)

Approve this audit (or pick items 1–5) and I'll switch to build mode and ship.
