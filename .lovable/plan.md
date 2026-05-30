# Plan: Big job UX + 25+ free source firehose

Two phases in one approved plan. Phase 1 ships the job-card popup and live apply-tracking UI. Phase 2 expands portal coverage from 5 → 25+ aggregator/ATS feeds, all running on Lovable Cloud's existing infra (pg_cron + server routes). No external worker, no paid feeds, no extra hosting cost.

Target freshness: **best job visible within ~15-60 min** of being posted (aggregators themselves lag ~5-30min from origin, so true "5min" is not realistic without paid feeds — your answer accepted this).

---

## Phase 1 — Job UX (frontend only)

### 1.1 Jobs page card (`src/routes/_authenticated/jobs.tsx`)
Each scraped job renders as a bento card with:
- Company logo placeholder + company name
- Job title (H3)
- Posted-time chip ("12 min ago", "3 h ago") via existing `timeAgo()`
- Experience level + employment type + location/remote
- Salary range if present
- Score chip (gold ≥85, emerald ≥60, muted otherwise)
- Portal badge (LinkedIn / Greenhouse / Lever / etc.)
- Two buttons: **View description** (opens dialog) and **Apply**

### 1.2 Job description dialog (`JobDescriptionDialog.tsx`)
Click "View description" → shadcn `Dialog` opens with sanitized HTML description, salary, location, requirements, and a prominent **Apply** button at the bottom. Apply inserts an `applications` row with `status='queued'` and navigates to `/applications/$id`.

### 1.3 Application detail page (`applications.$id.tsx`)
Mirrors the screenshot you uploaded. Two-column layout:

**Left rail (320px)** — stepper:
```text
1. Analyzing job        ✓
2. Optimizing resume    ● (active, shimmer)
3. Generating PDF
4. Writing cover letter
5. Filling form
6. Submitted
```
Status pill (queued / running / applied / failed), "Open job posting ↗" link, attempt counter.

**Right pane** — three tabs:
- **Live activity** — animated emerald pulse dot, current high-level action ("Writing cover letter…"), monospace tail of last 8 logs color-coded by level. Auto-scrolls. Once `status='applied'`, collapses to a slim success pill.
- **Form fill** — table of fields being filled, e.g. `Expected Salary → $120,000`, `Years of experience → 5`. Currently-filling row has a shimmering left border (framer-motion). Rows fade+slide in as new `logs` rows arrive with `scope='form.fill'`.
- **Resume & cover letter** — signed-URL PDF previews from the `resumes` storage bucket, skeleton while generating.

**Realtime**: Supabase `postgres_changes` on `applications:id=eq.$id` and `logs:application_id=eq.$id`.

### 1.4 Applications list link-up
Each row in `applications.tsx` becomes a `<Link to="/applications/$id">` so history items open the same detail view.

> Most of Phase 1 components already exist from the previous turn — this phase verifies + polishes them against the screenshot.

---

## Phase 2 — Source expansion (25+ portals, free)

### 2.1 Source adapters
Add one TanStack server route per provider under `src/routes/api/public/sources/`. Each route:
1. Fetches the provider's public JSON/RSS feed
2. Normalizes to our `jobs` schema (title, company, location, url, posted_at, description, salary, etc.)
3. Computes `dedupe_hash = sha256(source_key + source_job_id || url)`
4. Upserts into `jobs` (ON CONFLICT dedupe_hash DO NOTHING)
5. Runs filter matching → sets `score`, `matched`, `matched_filter_ids`
6. Inserts row in `automation_runs` with counts

**Free / no-key providers (Tier A — ship all):**
| Source | Type | Coverage |
|---|---|---|
| Greenhouse public boards | JSON `boards-api.greenhouse.io/v1/boards/{slug}/jobs` | 8000+ companies |
| Lever public postings | JSON `api.lever.co/v0/postings/{slug}` | 4000+ companies |
| Ashby public job board | JSON `api.ashbyhq.com/posting-api/job-board/{slug}` | 2000+ companies |
| Workable public | JSON `apply.workable.com/api/v3/accounts/{slug}/jobs` | 6000+ companies |
| SmartRecruiters public | JSON `api.smartrecruiters.com/v1/companies/{slug}/postings` | 4000+ companies |
| Recruitee public | JSON `{slug}.recruitee.com/api/offers/` | 1500+ companies |
| Personio public | JSON `{slug}.jobs.personio.de/xml` | 6000+ companies (EU) |
| Teamtailor public | JSON via slug | 1500+ companies |
| RemoteOK | JSON `remoteok.com/api` | aggregator |
| Remotive | JSON `remotive.com/api/remote-jobs` | aggregator |
| Arbeitnow | JSON `arbeitnow.com/api/job-board-api` | aggregator |
| Himalayas | JSON `himalayas.app/jobs/api` | aggregator |
| WeWorkRemotely | RSS `weworkremotely.com/categories/*.rss` | aggregator |
| Jobicy | JSON `jobicy.com/api/v2/remote-jobs` | aggregator |
| YCombinator Work at a Startup | JSON | 4000+ startups |
| Hacker News "Who is hiring" | Algolia API | monthly thread |
| GitHub Jobs (Hacktoberfest forks) | RSS | dev jobs |
| AngelList Talent (public) | scrape | startups |

**Tier B (add behind a "user provides key" toggle, free tiers):**
- Adzuna (free 1000 req/mo), Jooble (free), USAJobs, Reed (UK), Findwork.dev.

A company-slug catalog (~25k slugs across Greenhouse/Lever/Ashby/Workable/SmartRecruiters) ships as a JSON file in `src/lib/sources/company-slugs.json`. Coverage is then "thousands of career pages" without ever paying a per-call fee.

### 2.2 Scheduling (pg_cron, free)
Two cron jobs:
- **Hot tier — every 15 min**: aggregators + the top ~500 most-active company slugs.
- **Warm tier — every 60 min**: full slug catalog, sharded into 4 buckets (15-min-staggered) so each run handles ~6k slugs.

Each call hits a single TanStack server route `/api/public/sources/run-tier?tier=hot|warm&shard=N` that fans out fetches with `Promise.all` in batches of 20, with per-request 10s timeout.

### 2.3 Webhook ingestion (where supported)
Greenhouse, Lever, Ashby, Workable support job-posted webhooks. Server route `/api/public/sources/webhook/{provider}` accepts signed payloads → upsert immediately. Setup instructions surface in the new **Sources → Webhooks** tab. This is the "near-realtime" path; the rest stays on 15-min polling.

### 2.4 Filter matching & auto-discard
After each upsert, a Postgres function `match_job_to_filters(job_id)` runs:
- Loads user's active filter (`automation_settings.active_filter_id`)
- Scores against keywords, min_salary, location, employment_type, posted_within_hours
- If `score < filter.min_score` → set `jobs.status='discarded'` (hidden from dashboard but kept for audit)
- If matched and `automation_settings.enabled=true` → insert into `applications(status='queued')` automatically

### 2.5 Sources UI updates (`sources.tsx`)
- Group sources by tier (Hot / Warm / Webhook)
- Toggle per source, edit slug list inline (textarea, one slug per line)
- "Last run", "Found in last hour", "Errors" columns
- "Add company slug" quick form (auto-detects provider from URL)

### 2.6 Dashboard updates (`dashboard.tsx`)
- Add "Jobs found in last hour" big-number tile
- "Discarded vs matched" donut
- "Per-source throughput (24h)" sparkline grid
- Realtime: new matched job slides into a "Just in" rail at the top

---

## Technical notes

- **No new infra**. Everything runs on existing Lovable Cloud workers (TanStack server routes) + Supabase pg_cron + pg_net. Zero recurring cost beyond the Cloud usage already in place.
- **Rate-limit safety**: per-provider concurrency cap + exponential backoff written into a shared `src/lib/sources/fetch-with-budget.ts` helper. Failed sources mark `sources.last_error` so the UI surfaces them.
- **Dedup**: `dedupe_hash` UNIQUE index added in a migration; same job from 3 sources counts once.
- **Migrations needed (Phase 2)**:
  - `ALTER TABLE jobs ADD CONSTRAINT jobs_dedupe_hash_unique UNIQUE (user_id, dedupe_hash)`
  - `CREATE INDEX jobs_status_score_idx ON jobs(status, score DESC)`
  - `CREATE FUNCTION match_job_to_filters(...)` + trigger on insert
  - Seed default sources via `supabase--insert`
- **Worker contract unchanged**: the apply-worker (your external Python/Node piece) still consumes `applications` rows via the existing `worker_commands` queue. Phase 1's UI reads its `logs` output. If you don't yet have that worker running, the UI degrades gracefully (no logs → empty Live Activity panel) — that's a separate ticket.
- **Out of scope**: building the apply-worker itself, paid feeds (Coresignal/TheirStack), LinkedIn scraping (ToS-hostile, account-ban risk), and CAPTCHA solving.

## Execution order (after you approve)
1. Phase 1 UI verification + polish (jobs page, dialog, detail page, list links)
2. Phase 2 migration (dedup index + matching function)
3. Phase 2 source adapters (Tier A, all 18 providers in one batch)
4. pg_cron schedules + slug seed data
5. Sources UI + Dashboard tiles
6. Smoke test: trigger hot tier manually, verify jobs land in dashboard within 30s
