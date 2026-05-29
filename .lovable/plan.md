
# Personal Job Hunt Automation — Master Plan

A single-user, login-gated dashboard that controls a Python automation engine running on your VPS. The engine scrapes jobs from free + paid sources, tailors a LaTeX resume per job with AI, auto-applies, and uses your Gmail to read OTPs/verification links. Built to survive rate-limits and captchas long-term.

## System architecture (high level)

```text
   Browser (you only)
        │
        ▼
  Lovable Frontend (TanStack Start)
  - Login (Lovable Cloud auth, single user, no signup)
  - Dashboard, Jobs Feed, Applications, Profile, Automation Settings
        │  reads/writes
        ▼
  Lovable Cloud (Postgres + Storage + Auth)
  - jobs, applications, profile, sources, settings, runs, logs, resumes
        │  long-poll / job queue rows
        ▼
  Python Worker on your VPS (Docker)
  - Scrapers: Apify actors (LI/Indeed/ZR/Dice) + free APIs (Adzuna, Jooble,
    RemoteOK, Remotive, USAJobs, Greenhouse/Lever/Ashby boards)
  - AI: OpenAI + DeepSeek (resume/cover-letter tailoring on LaTeX)
  - LaTeX compile (tectonic) → PDF in Cloud Storage
  - Apply engine: Playwright + stealth, residential proxy rotation,
    2Captcha/CapSolver, human-like behavior
  - Gmail OAuth client: reads OTPs + verification links on demand
  - Scheduler (APScheduler): per-source cadence, daily windows, 24/7 mode
```

Two clean boundaries. Frontend never holds API keys. Worker never serves UI.

## Tech choices (locked)

- **Frontend/DB/Auth/Storage**: Lovable Cloud (Supabase under the hood).
- **Worker host**: Your VPS (Hetzner/DO) — Docker Compose, 1 Python container + 1 Postgres-less (uses Cloud DB directly via service role).
- **Browser automation**: Playwright (Python) + `playwright-stealth` + residential proxies + 2Captcha/CapSolver.
- **AI**: OpenAI (GPT) for tailoring/parsing, DeepSeek (reasoner) for "think before apply" decisions and ambiguous form fields. No other models.
- **Resume**: Your uploaded `.tex` template; AI only mutates content strings inside whitelisted placeholders (e.g. `% LOV:summary` … `% LOV:end`), never LaTeX commands. Compile with `tectonic`.
- **Gmail**: Per-user OAuth (you are the user) — read-only `gmail.readonly` + `gmail.modify` for marking processed. The worker holds the refresh token.
- **Scheduling**: APScheduler in the worker; per-source cadence + global daily window.

---

## Phase 1 — Foundation (frontend shell + auth + DB schema)

Goal: You can log in, see empty dashboard, and the data model is fully in place.

1. Enable Lovable Cloud.
2. Single-user auth: email/password login page only. Disable signup in code (whitelist one email). Forgot/reset password page.
3. Layout: `/login`, `_authenticated` layout with sidebar → `/dashboard`, `/jobs`, `/applications`, `/profile`, `/automation`, `/sources`, `/logs`.
4. DB tables (Cloud, all with RLS scoped to `auth.uid()`):
   - `profile` — your name, contact, links, work-auth, salary expectations, locations, default cover letter tone.
   - `experiences`, `projects`, `skills`, `educations` — structured items the AI picks from per job.
   - `resumes` — uploaded `.tex` templates + the per-application generated PDFs (Storage refs).
   - `sources` — one row per scraping source (apify_linkedin, apify_indeed, apify_zip, apify_dice, adzuna, jooble, remoteok, …) with `enabled`, `config jsonb` (actor id, max_jobs, queries, locations, freshness), `cadence_minutes`.
   - `filters` — saved filter sets (keywords, exclude_keywords, exclude_companies, locations, remote, salary_min, posted_within_hours, seniority).
   - `jobs` — normalized scraped jobs (source, source_job_id unique, title, company, location, remote, url, description, salary, posted_at, raw jsonb, dedupe_hash, matched_filter_ids[], score).
   - `applications` — job_id, status (queued/applying/applied/failed/needs_review), resume_pdf_id, cover_letter_pdf_id, attempts, last_error, applied_at, screenshot_refs[].
   - `automation_settings` — daily window (start/end or 24/7), max_applies_per_day, parallelism, aggressiveness (1-5, default 5), per-source overrides, captcha provider, proxy pool id.
   - `automation_runs` — start, end, source, counts, errors.
   - `logs` — append-only worker events (level, scope, message, jobid?, applicationid?).
   - `secrets_meta` — names only of secrets stored on the worker (UI shows status, never values).
   - `gmail_tokens` — encrypted refresh token (server-only).
5. SQL grants + RLS on every table.

## Phase 2 — Profile & Sources UI (you fill in your data)

Goal: All inputs the engine needs are editable in-app.

1. `/profile` — full personal info, work-auth, locations, salary, links. Upload your `.tex` resume → stored in Storage with placeholder markers detected and previewed.
2. Experiences/Projects/Skills/Educations CRUD with drag-reorder.
3. `/sources` — toggle each source; per-source config form (Apify actor id + per-actor settings like `maxItems`, `searchTerms`, `locations`, `publishedAt`; free APIs only need keywords/locations).
4. `/filters` — saved filter sets; default filter marker; "preview filter against last 200 jobs" button.
5. `/automation` — daily window, 24/7 toggle, max applies/day, exclude companies list, aggressiveness, captcha + proxy provider selection (just labels — actual keys live on the worker).

## Phase 3 — VPS worker skeleton + scraping

Goal: Worker runs on your VPS, pulls source configs from Cloud, writes deduped jobs back. No applying yet.

1. Repo `worker/` with: `Dockerfile`, `docker-compose.yml`, `pyproject.toml`, `.env.example` (APIFY_TOKEN, OPENAI_API_KEY, DEEPSEEK_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CAPTCHA_KEY, PROXY_URL, GMAIL_CLIENT_ID/SECRET/REFRESH).
2. Supabase Python client with service role; pydantic models mirroring tables.
3. APScheduler entry: every source's `cadence_minutes` triggers a scrape job.
4. Source adapters (one module each):
   - **Apify**: LinkedIn, Indeed, ZipRecruiter, Dice — call `actor.start` with config from DB row, poll dataset, normalize.
   - **Free**: Adzuna, Jooble, RemoteOK, Remotive, USAJobs, plus generic Greenhouse/Lever/Ashby board fetchers (you paste company slugs).
5. Normalizer → `jobs` table with `dedupe_hash = sha256(company|title|location|source_url)`.
6. Filter engine: for each new job, evaluate against all enabled `filters`, attach matching ids + a 0-100 relevance score (keyword + recency + salary fit). Only matched jobs surface in UI.
7. Deploy script: `./deploy.sh` builds + restarts container; systemd unit for auto-restart.

## Phase 4 — Dashboard, Jobs Feed, Kanban

Goal: You can actually browse, filter, and select jobs.

1. `/dashboard` — KPI cards (jobs today, matched today, applied today, success rate, captcha hits, rate-limit events), recent runs, recent applications, sparkline of jobs/hour.
2. `/jobs` — card grid of FILTERED jobs only. Quick filters: "Last 1h / 24h / 3d / 7d / custom", source chips, search. Each card: title, company, location, salary, posted-relative, source badge, match score, "Apply" + "Skip" + "Save".
3. Bulk select → "Apply to N" pushes them to `applications` with `status=queued`.
4. `/applications` — Kanban: Queued → Applying → Applied → Needs Review → Failed. Click card → drawer with job desc, generated resume PDF preview, cover letter, screenshots, worker logs for that application.

## Phase 5 — Resume/cover-letter AI + LaTeX compile

Goal: Per-job tailored PDFs that never break your LaTeX.

1. Template contract: your `.tex` has marker pairs the AI may rewrite:
   ```
   % LOV:summary
   ...content...
   % LOV:end
   % LOV:bullets:exp1
   ...
   % LOV:end
   ```
2. Worker pipeline per queued application:
   a. DeepSeek-reasoner: read job description + your profile/experiences/skills → output structured JSON (which experiences to include, which skills to surface, summary angle, keywords to mirror, red flags).
   b. OpenAI (GPT): given that JSON + the LaTeX template, return ONLY the replacement content blocks (validated against the marker list — reject if any LaTeX command is touched).
   c. Splice content into template (string replace inside markers only).
   d. `tectonic` compile → PDF → upload to Storage → `resume_pdf_id` on application.
   e. Same flow for `cover_letter.tex`.
3. UI preview before apply when aggressiveness ≤ 3; auto-proceed when ≥ 4 (you chose 5).

## Phase 6 — Apply engine + Gmail OTP + anti-bot

Goal: Worker actually clicks Apply, including OTP/email-verify flows.

1. Per-portal adapters (start with the highest-value: LinkedIn Easy Apply, Indeed Quick Apply, ZipRecruiter 1-Click, Dice, Greenhouse, Lever, Ashby, Workday).
2. Playwright with `playwright-stealth`, randomized viewport/UA, human-like timing (typed not pasted, mouse jitter, random scrolls, 1-4s think pauses), one persistent profile per portal (cookies survive).
3. Residential proxy per portal session; rotate on rate-limit.
4. **Gmail OTP loop**: when a form/modal demands a code or "click this link":
   - Worker polls Gmail API for messages received in last 5 min matching `from:portal_domain` or subject keywords.
   - DeepSeek-reasoner parses the email body → extracts OTP/verification URL.
   - Worker fills OTP or visits the link in the same browser context, then continues.
5. Account creation flow per portal: stored email + password, AI fills profile fields from your `profile`, experiences, generated resume; uploads PDF; submits.
6. Captcha hook: on detection (visual or `recaptcha`/`hcaptcha` iframe), call 2Captcha/CapSolver, inject token, continue.
7. Failure handling: 3 attempts with backoff → `Needs Review` with full screenshot + DOM snapshot + log trail.
8. Per-portal rate budget (e.g. LinkedIn max 15/day) enforced in worker; falls back when hit.

## Phase 7 — Anti-detection longevity layer (the "week 2" problem)

Goal: Stay alive past the 7-10 day mark when portals start blocking.

1. **Identity rotation pool**: maintain 3-5 browser fingerprints per portal (UA, screen, fonts, timezone, WebGL hash via `playwright-stealth` + `browserforge`). Rotate on session.
2. **IP hygiene**: residential proxies, sticky session per login (so cookies stay valid), rotate IP only when challenged.
3. **Behavior diversity**: vary timing distributions weekly; insert "browsing" actions (open 2 unrelated jobs, scroll, close) so apply isn't 100% of activity.
4. **Cadence smoothing**: never burst. Spread daily apply quota across the active window with jitter.
5. **Health monitor**: per-portal score (recent challenges, captcha frequency, 429s). When score drops, auto-cool-down 24-48h on that portal.
6. **Optional escalation paths** (documented, toggleable in `/automation`):
   - Switch to provider's official ATS APIs where available (Greenhouse, Lever, Ashby all have public job/apply APIs).
   - Use Apify "actor" mode for apply on portals that have one (offloads detection problem to them).
   - Browser-as-service fallback (Browserless/Browserbase) per portal when local fingerprint burns.
7. **Alerting**: when a portal goes red, dashboard shows banner + email to you with the suggested fix.

## Phase 8 — Polish, observability, hardening

1. `/logs` — searchable, filterable log viewer (level, scope, time, application id).
2. Daily digest email (via your own Gmail) summarizing scraped/applied/failed.
3. Per-application "retry" and "mark applied manually" actions.
4. Backup/export: nightly DB snapshot, CSV export of applications.
5. Worker → Cloud heartbeat row; dashboard shows "Worker online / last seen".
6. Secrets rotation UI: status-only on frontend, rotate via worker CLI.

---

## Technical specifics

**Auth model**: Single-user. After first signup you'll seed your row, then we hard-disable new signups in code + a DB trigger that blocks inserts in `auth.users` beyond 1.

**Frontend ↔ Worker contract**: Worker reads/writes the Cloud DB directly with service-role key. No HTTP API needed between them. Frontend writes things like `applications.status='queued'`; worker picks them up via Supabase realtime subscription (or 5s poll fallback). This keeps the system simple and resilient.

**Why DB-as-queue not Redis**: One user, low volume (max a few hundred jobs/day), and you already have Postgres. Adds zero infra. Can swap to pgmq later if needed.

**Why not run scraping in Lovable**: Cloudflare Workers can't run Playwright, can't run `tectonic`, can't open long-lived sockets to Gmail, can't host proxy connections. The Python VPS worker is non-negotiable for real automation.

**Secrets layout**:
- **Lovable Cloud secrets** (none required for app code itself — frontend is dumb).
- **VPS `.env`** (on the worker only): APIFY_TOKEN, OPENAI_API_KEY, DEEPSEEK_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CAPTCHA_PROVIDER+KEY, PROXY_URL, GMAIL_CLIENT_ID/SECRET/REFRESH_TOKEN, ENCRYPTION_KEY (for any stored portal credentials).

**LaTeX safety**: AI output is validated against an allowlist of marker IDs and a regex that forbids backslashes/braces in returned content. Any violation → reject + retry with stricter prompt → after 2 fails, fall back to a generic tailored version.

**Apify cost control**: Each source row stores `max_jobs_per_run` and `cadence_minutes`. UI shows estimated monthly Apify spend based on actor pricing.

---

## What I need from you before Phase 3

1. The `.tex` resume file (upload it in chat — I'll add the `% LOV:` markers and show you the diff).
2. Your Apify token, OpenAI key, DeepSeek key — once Cloud is enabled I'll request them via the secrets flow (they go on the VPS, not in the project).
3. Pick captcha provider (2Captcha is cheapest, CapSolver is fastest) and proxy provider (IPRoyal is cheapest residential, BrightData is most reliable).
4. VPS IP + SSH access ready (any 2GB+ Ubuntu 22.04 box works; Hetzner CX22 €3.79/mo is fine).

## What we'll ship in this implementation pass

If you approve, I'll execute **Phase 1 + Phase 2** in the first build (everything that lives in Lovable: auth, schema, profile/sources/filters/automation UIs, jobs/applications page shells). Then we'll do Phases 3-7 on the VPS in subsequent passes — each one self-contained, deployable, testable. Phase 8 last.

Ready to start with Phase 1+2?
