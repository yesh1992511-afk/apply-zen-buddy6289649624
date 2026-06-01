# Fix scraping pipeline

## Problem

All 6 Apify sources (LinkedIn, Indeed, Glassdoor, ZipRecruiter, Wellfound, Google Jobs) are returning **0 items** every run, despite a valid `APIFY_TOKEN` and 20+ targeted cybersecurity keywords being sent. ATS/board sources (Greenhouse, Ashby, USAJobs) work fine and deliver hundreds of jobs.

Root cause: our adapters send **the wrong input payload shape** to each Apify actor. For example, `bebity/linkedin-jobs-scraper` does not accept `{ queries, locations, rows }` — it expects an array of LinkedIn job-search URLs. The actor runs succeed (HTTP 200), but with invalid input it produces an empty dataset, so we record `last_run_count = 0` with no error.

A second issue: when an Apify run returns 0, we silently store "succeeded" with no error. The user has no way to tell the difference between "site has no matching jobs" and "we sent garbage to the actor".

## Scope

Frontend-light, backend-focused. Only files involved in source scraping. No schema changes.

## Plan

### 1. Rewrite Apify adapter inputs (`src/lib/sources/adapters.server.ts`)

For each of the 6 Apify actors, send the schema the actor actually documents:

- **`bebity/linkedin-jobs-scraper`** — build LinkedIn job-search URLs from each `(query, location)` pair: `https://www.linkedin.com/jobs/search/?keywords=...&location=...&f_TPR=r604800` (last 7 days). Send `{ urls: [...up to 10...], scrapeCompany: false, count: 50, proxy: { useApifyProxy: true } }`. Cap query×location combinations to keep one run under the 100 s sync timeout.
- **`misceres/indeed-scraper`** — switch to per-query loop, send `{ position, country: 'US', location, maxItems: 50, parseCompanyDetails: false, saveOnlyUniqueItems: true }` and merge results (capped). Current single-query call is correct shape, just under-utilized.
- **`bebity/glassdoor-jobs-scraper`** — same URL-based pattern as LinkedIn but for Glassdoor search URLs.
- **`bebity/ziprecruiter-scraper`** — replace `queries/locations/rows` with the documented `{ searchUrls: [...zip job search URLs...], maxItems: 50, proxy }`.
- **`epctex/wellfound-scraper`** — Wellfound (AngelList) actor takes `{ startUrls: [{ url: 'https://wellfound.com/jobs?role=...&location=...' }], maxItems: 50 }`. Rewrite accordingly.
- **`dan.poltawski/google-jobs-scraper`** — this actor slug is unreliable. Switch to the well-maintained `apify/google-jobs-scraper` (or `dan.poltawski~google-jobs-scraper-2`) with `{ queries: [...], countryCode: 'us', languageCode: 'en', maxPagesPerQuery: 2 }`. Probe once and pick whichever returns items.

Add a small helper `buildLinkedInSearchUrls(queries, locations)` and `buildGlassdoorSearchUrls(...)` to keep adapter bodies clean.

### 2. Cap query fan-out + add timing safety

The user has 20 target titles × 1 location = 20 combinations. Sending all to one actor will time out. Add a top-level cap (e.g. 8 query×location URLs per actor run) and pick the longest/most-specific queries first. Document the cap in code.

### 3. Surface "0 items but ran" as a soft warning

In `run-tier.ts` / `run-batch.ts`, when an Apify source returns 0 items:
- Store `last_run_status = 'succeeded'` with `last_error = "Apify run returned 0 items — actor input may be misconfigured (see logs)."` so the existing Sources UI shows it.
- Log the actor id, payload keys, and the raw Apify response length so we can debug from server logs.

### 4. One verification batch + manual check

After deploy, trigger one batch from "Match & prepare" with the user's existing targets, then verify in the `jobs` table that each Apify source produced > 0 rows (or has a clear `last_error` if it didn't). Re-rescore via the existing `rescore_all_jobs_for_user`.

## Files touched

- `src/lib/sources/adapters.server.ts` — rewrite 6 Apify adapter bodies + add URL helpers + cap.
- `src/routes/api/public/sources/run-tier.ts` — record 0-item warning into `sources.last_error`.
- `src/routes/api/public/sources/run-batch.ts` — same 0-item warning in batch path.

No schema changes, no new secrets, no UI changes. All queries remain user-scoped via existing RLS.

## Out of scope

- New scraper providers (e.g. JobSpy, SerpAPI). Can be a follow-up.
- Changing the matcher (already fixed in previous turn).
- UI changes — the existing "All scraped" toggle on Jobs already covers visibility.
