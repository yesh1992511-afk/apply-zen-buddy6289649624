
# Phase A — Scraping in Lovable Cloud (perfect wiring + expanded coverage)

Most plumbing already exists (`src/lib/sources/adapters.server.ts`, `src/routes/api/public/sources/run-tier.ts`, 6 aggregators, 47 seed slugs). What's missing is **pg_cron scheduling**, **paid/Apify sources**, **USAJobs**, **more ATS adapters**, and a **massive seed-slug expansion**. After this, the Scraper card turns green and 1,000+ career pages get pulled every 15–60 min automatically.

## What you get

- **6 free aggregators** (already built) — RemoteOK, Remotive, Arbeitnow, Himalayas, Jobicy, WeWorkRemotely → run every **15 min**
- **9 ATS providers** (Greenhouse, Lever, Ashby, Workable, SmartRecruiters, Recruitee, **+ Teamtailor, Personio, BambooHR**) → run every **60 min** in 4 shards
- **USAJobs** (federal jobs) → every 60 min, uses your existing `USAJOBS_API_KEY`
- **6 Apify actors** (LinkedIn, Indeed, Glassdoor, ZipRecruiter, Wellfound, Google Jobs) → every 4 hours, uses your existing `APIFY_TOKEN`. Fire-and-forget pattern so no source can stall the cron.
- **Seed list expanded from ~47 → ~250 companies** across Greenhouse/Lever/Ashby/Workable
- **Scraper heartbeat turns green** — `/worker` page reads `automation_runs WHERE kind LIKE 'source.%'`
- **Per-source health stays accurate** — each adapter writes `sources.last_run_at/status/count/error` so the source-health table on `/worker` reflects real state

## Wiring guarantee (your "will it perfectly wire" question)

```text
pg_cron (every 15m / 60m / 4h)
        │
        ▼
GET /api/public/sources/run-tier?tier=hot|warm|apify|usajobs&shard=N
        │   (already exists, will extend with new tiers)
        ▼
For each user with automation_settings.enabled = true
        │
        ├─ Fetch adapters in parallel (concurrency 8)
        ├─ Upsert into jobs ON CONFLICT(user_id,dedupe_hash) DO NOTHING
        ├─ Call match_job_to_filters(job_id)   ◀── existing trigger, scores+matches
        ├─ Update sources.last_run_* per adapter
        └─ Insert automation_runs row    ◀── makes Scraper card green
```

Three independent failure domains: aggregator timeout doesn't block ATS, Apify failure doesn't block USAJobs, one user's failure doesn't block other users. Every adapter has a 10s timeout and try/catch.

## Steps

### 1. Extend adapters.server.ts
- Add `fetchTeamtailor(slug)`, `fetchPersonio(slug)`, `fetchBambooHR(slug)`
- Add `fetchUSAJobs(keyword, location)` using `process.env.USAJOBS_API_KEY` + `USAJOBS_USER_AGENT_EMAIL`
- Add Apify adapters: `fetchApifyLinkedIn`, `fetchApifyIndeed`, `fetchApifyGlassdoor`, `fetchApifyZipRecruiter`, `fetchApifyWellfound`, `fetchApifyGoogleJobs` — all use the **sync-get-dataset-items** endpoint with a 50s cap; if Apify is slow we skip this tick (no blocking)
- Extend `runSource()` switch to handle the new providers
- Bump `AGGREGATOR_PROVIDERS` list and add new `APIFY_PROVIDERS`, `USAJOBS_PROVIDERS` constants

### 2. Expand seed-slugs.ts (~47 → ~250)
Add curated slugs for big tech, fintech, AI labs, climate, healthtech, defense, devtools — organized by provider. Source list compiled from public boards (Greenhouse: ~120, Lever: ~50, Ashby: ~40, Workable: ~20, Teamtailor: ~20).

### 3. Extend run-tier.ts
- Accept `tier=hot|warm|apify|usajobs`
- For `apify` tier, wrap each adapter in `Promise.race` with a 50s timeout (cron HTTP call can't exceed ~60s)
- Per-source health: after each adapter completes, `UPDATE sources SET last_run_at, last_run_status, last_run_count, last_error WHERE user_id=$1 AND key=$2` (insert row if missing — auto-registers new sources on first run)
- Tighten errors: bubble adapter exception messages into `automation_runs.metadata.errors[]` so `/worker` shows the actual reason

### 4. Update `/worker` Scraper card logic
- Filter `runs.find(r => r.kind?.startsWith('source.'))` instead of generic `kind === 'scrape'`
- Show last-tier badge (hot/warm/apify) under the heartbeat

### 5. Schedule pg_cron (via `supabase--insert` not migration — they're user-specific)
```sql
SELECT cron.schedule('scrape-hot',     '*/15 * * * *',
  $$SELECT net.http_get(url := 'https://project--ba5780a8-641e-4ee8-9c24-6e1c185cef2f.lovable.app/api/public/sources/run-tier?tier=hot')$$);
SELECT cron.schedule('scrape-warm-0',  '5,35 * * * *',
  $$SELECT net.http_get(url := '...?tier=warm&shard=0')$$);
-- shards 1,2,3 staggered at 10/40, 15/45, 20/50
SELECT cron.schedule('scrape-usajobs', '25 * * * *',
  $$SELECT net.http_get(url := '...?tier=usajobs')$$);
SELECT cron.schedule('scrape-apify',   '0 */4 * * *',
  $$SELECT net.http_get(url := '...?tier=apify')$$);
```
Enable `pg_cron` + `pg_net` extensions if not already on.

### 6. Verify
- Hit each tier endpoint manually with `invoke-server-function` and confirm rows appear in `jobs` + `automation_runs`
- Check `/worker` page → Scraper card goes green within 15 min
- Check `cron.job_run_details` for any failed cron runs

## Technical notes

- **Apify timeout strategy**: Cloudflare Workers cap server requests at ~60s. Apify sync-get-dataset-items returns immediately if dataset exists, or waits. We use `timeout=50000` query param + AbortController. If a run times out, we skip and try next tick — no orphaned actor runs because we use cached/last-completed runs not start-new.
- **VPS scraper code stays untouched** — `worker/app/sources/*` keeps working as a backup, but pg_cron is now the primary path. Phase B-style cleanup of VPS scrapers can come later.
- **Cost**: ATS + aggregators + USAJobs are free. Apify costs ~$0.001–0.01 per dataset call depending on actor; running 6 actors every 4h = ~36 calls/day = pennies.
- **No new secrets needed** — `APIFY_TOKEN`, `USAJOBS_API_KEY`, `USAJOBS_USER_AGENT_EMAIL` all already exist.

## Files touched

- `src/lib/sources/adapters.server.ts` — add 10 new adapter functions + extend `runSource()`
- `src/lib/sources/seed-slugs.ts` — expand from 47 → ~250 entries
- `src/routes/api/public/sources/run-tier.ts` — handle new tiers, per-source health writes, timeout wrapping
- `src/routes/_authenticated/worker.tsx` — Scraper card filter + tier badge
- pg_cron jobs (via `supabase--insert`)

After approval I'll execute steps 1-6 in order and verify with a test invocation before handing back.
