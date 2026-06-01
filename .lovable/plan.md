# Universal HTML rendering + reliable Apify scraping

## Scope
1. Make **every** source's job description render as readable text — not as raw `<div>` markup or escaped `&lt;`. Today only Greenhouse was hardened; do it for all adapters.
2. Make Apify scraping work consistently for all 6 portals (LinkedIn, Indeed, Glassdoor, ZipRecruiter, Wellfound, Google Jobs) and — when it doesn't return anything — record an honest, useful error instead of `succeeded / 0`.

## Current state (audit)
- All 6 Apify sources show `last_run_status=succeeded, last_run_count=0, last_error=NULL` — they finish without telling us anything.
- Existing rows in `jobs` are mostly real HTML now, but new scrapes from non-Greenhouse adapters can still arrive entity-encoded or with mixed text/HTML — the dialog already decodes defensively, but the data layer should be the source of truth.

## Part 1 — Universal description normalization

### 1.1 Extract helper
New file `src/lib/sources/normalize.server.ts`:
- `decodeHtmlEntities(str)` — moved out of `adapters.server.ts` (already used by Greenhouse).
- `normalizeDescription(input)` returns `{ description, description_html }`:
  - decodes entities
  - trims, collapses extra whitespace
  - if input has no `<` after decode, treats it as plain text → returns `{ description: text, description_html: null }`
  - if input has tags, returns `{ description: stripTags(decoded), description_html: decoded }`
  - caps `description` at 8000 chars

### 1.2 Apply to every adapter
`src/lib/sources/adapters.server.ts` — replace the per-adapter `description: …slice/replace…` / `description_html: …` pairs with a single call to `normalizeDescription(raw)` in:
greenhouse, lever, ashby, workable, smartrecruiters, recruitee, personio, teamtailor, workday, jobvite, usajobs, and every apify adapter (linkedin, indeed, glassdoor, ziprecruiter, wellfound, google_jobs).

### 1.3 Backfill (data-only migration)
One migration that re-normalizes existing `jobs` rows where `description_html` is still entity-encoded across **all** sources (not just `greenhouse:%`). Uses the same `replace` chain already proven for the Greenhouse backfill.

### 1.4 Render layer
Leave `JobDescriptionDialog` as-is — it already decodes defensively, which is the right belt-and-braces.

## Part 2 — Reliable Apify scraping

### 2.1 New Apify client wrapper
`src/lib/sources/apify-client.server.ts`:
- `runActorSync(actorId, input, { token, timeoutSec=120 })`:
  - calls `POST https://api.apify.com/v2/acts/{actorId}/run-sync-get-dataset-items?token=…&timeout=…&format=json`
  - on non-2xx → throws `ApifyError` with `status`, first 500 chars of body
  - on 2xx + empty array → reads `X-Apify-Pagination-Run-Id` header, fetches `/v2/actor-runs/{runId}` and `/v2/actor-runs/{runId}/log?limit=2000`, throws `ApifyEmptyError` carrying:
    - `runId`, `runStatus`, `statusMessage`, `exitCode`
    - tail of the run log (200 chars)
    - the input payload we sent (for the UI)
- All errors include actorId + a one-line input summary.

### 2.2 Rewrite the 6 adapters with current, documented input schemas
`src/lib/sources/adapters.server.ts` — each adapter calls `runActorSync` and translates output to `NormalizedJob[]`. Inputs pinned to the simplest, most stable schema per actor:

```text
linkedin     bebity/linkedin-jobs-scraper        { urls: [linkedinSearchUrl], scrapeCompany:false, count:50 }
indeed       misceres/indeed-scraper             { position, country:"US", location, maxItems:50, parseCompanyDetails:false, saveOnlyUniqueItems:true }
glassdoor    bebity/glassdoor-jobs-scraper       { urls: [glassdoorSearchUrl], maxItems:50 }
ziprecruiter epctex/ziprecruiter-scraper         { startUrls:[ziprecruiterSearchUrl], maxItems:50, proxy:{useApifyProxy:true} }
wellfound    curious_coder/wellfound-jobs-scraper{ url: wellfoundUrl, count:50 }
google_jobs  apify/google-jobs-scraper           { queries:[...], countryCode:"us", languageCode:"en", maxPagesPerQuery:2 }
```

Query/URL fan-out continues to use existing `pairQueriesLocations` cap (8 combinations per actor run), longest queries first.

### 2.3 Honest source status
`src/routes/api/public/sources/run-batch.ts` and `run-tier.ts`:
- Catch `ApifyError` / `ApifyEmptyError` from each Apify adapter and write to `sources`:
  - `last_run_status = 'failed'` when the actor errored
  - `last_run_status = 'succeeded'` + descriptive `last_error` when the actor finished cleanly but produced 0 items (e.g. `"Apify run ABC123 finished SUCCEEDED but dataset is empty. Tail: <log snippet>. Verify input schema for actor X."`)
- Stop writing the generic "Source returned 0 cyber-relevant jobs this run." — replace with a specific reason (`country_filter_blocked: 12`, `title_keyword_no_match: 47`, etc.) by counting why jobs got dropped during matching.

### 2.4 Debug endpoint (read-only)
New `src/routes/api/public/sources/apify-probe.ts`:
- `GET /api/public/sources/apify-probe?source=apify:linkedin&user=<id>`
- Requires `x-internal-secret: WORKER_CRON_SECRET`.
- Calls the same adapter but returns the raw Apify run summary + first 3 dataset items + the run log tail as JSON.
- Lets us answer "why 0 results?" in one curl without consuming meaningful credits.

### 2.5 Verification
After deploy, hit `apify-probe` for each of the 6 sources via `invoke-server-function`. Confirm one of:
- dataset has items → adapter works
- empty dataset → log snippet now explains why (wrong proxy, wrong country, captcha, blocked URL, etc.). Adjust input until non-empty for at least LinkedIn + Indeed + Google Jobs (the three highest-volume).

## Files touched
- New: `src/lib/sources/normalize.server.ts`
- New: `src/lib/sources/apify-client.server.ts`
- New: `src/routes/api/public/sources/apify-probe.ts`
- Edit: `src/lib/sources/adapters.server.ts` (all ~14 adapters)
- Edit: `src/routes/api/public/sources/run-batch.ts`, `run-tier.ts` (status/error reporting)
- One data-only SQL migration (entity backfill across all sources)

## Not changed
- DB schema, RLS, auth.
- `JobDescriptionDialog` UI (defensive decode already in place).
- The matching function and the Matched/All scraped UI toggle.

## Honest expectation
Apify actors change their input contracts frequently. Pinned inputs above match the most recent public docs as of June 2026, but if an actor has updated again, the new probe endpoint + run-log capture will tell us exactly what to change — instead of leaving the user staring at `0` again.
