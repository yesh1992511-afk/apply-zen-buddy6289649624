# Why you got 2000 jobs but 0 matches

I dug into the database and the scrapers. The system is **not** broken at random — there are two specific, fixable bugs:

## Diagnosis

**1. All 6 Apify sources return 0 jobs (LinkedIn, Indeed, Glassdoor, ZipRecruiter, Wellfound, Google Jobs).**
Your APIFY_TOKEN works. The bug is in the adapter: it calls
`/v2/acts/{actor}/runs/last/dataset/items` — that endpoint only returns the dataset of an actor's **last completed run**. It never starts a new run. So unless you've manually scheduled those actors on apify.com (you haven't), the dataset is empty and the adapter happily returns `[]` and reports "succeeded, 0 items".

The Python worker has the correct behavior (POSTs `run-sync-get-dataset-items` with your keywords) — but the cron path uses the TanStack route, which doesn't.

**2. The 2088 jobs we DO have are almost all not cybersecurity, and the country filter drops the rest.**

The active filter is `Cybersecurity — USA`, keywords like `security engineer`, `SOC analyst`, `penetration tester`, locations `[United States]`.

But the boards being scraped are generic engineering:
```
greenhouse:mongodb       429 jobs
usajobs                  411
greenhouse:roblox        260
greenhouse:airbnb        236
lever:mistral            165
jobicy / arbeitnow       100 each
remoteok                 100
```
None of these are cyber-focused, so almost nothing hits the cyber keywords. The few that might match get killed by the country gate in `match_job_to_filters`: it requires the job's `location` string to contain `"united states"`, `" usa"`, `", us"`, `"remote"`, `"anywhere"`, or a US state name — jobs with a blank location or `"New York, US"` (no comma-space) fall through and are marked country_ok=false.

Cybersecurity-specialist boards (**InfoSec-Jobs, CyberSecJobs, ClearedJobs, HN cybersec**) exist in the Python worker but are **not** wired into the TanStack adapter set the cron actually runs.

## Fix plan

### 1. Make Apify actually scrape (TanStack adapter)
File: `src/lib/sources/adapters.server.ts`

Replace `fetchApifyLastRun` with `runApifyActor` that POSTs to
`https://api.apify.com/v2/acts/{actor}/run-sync-get-dataset-items?token=…&timeout=120`
with a per-actor payload built from `automation_settings.target_titles` + `target_locations`:

- `bebity~linkedin-jobs-scraper`: `{ queries:[…], locations:[…], rows:100, proxy:{useApifyProxy:true} }`
- `misceres~indeed-scraper`: `{ position, country:"US", location, maxItems:100 }`
- `bebity~glassdoor-jobs-scraper` / `bebity~ziprecruiter-scraper`: same shape as LinkedIn
- `dan.poltawski~google-jobs-scraper`: `{ queries, countryCode:"us", maxPagesPerQuery:2 }`
- `epctex~wellfound-scraper`: `{ search:queries[0], maxItems:100 }`

Cap each actor at ~120s, errors → mark source `failed` with the upstream message (right now they all silently say "succeeded, 0").

### 2. Add cybersecurity-specific sources
File: `src/lib/sources/adapters.server.ts`

Port these adapters from the Python worker (`worker/app/sources/`) into the TanStack module:
- `infosec-jobs.com` (JSON feed)
- `cybersecjobs.com` RSS
- `clearedjobs.net` RSS
- `hn:who-is-hiring` (filter latest thread for cyber keywords)

Register them in `AGGREGATOR_PROVIDERS` so the hot tier picks them up every 15 min.

### 3. Loosen `match_job_to_filters` country gate
Migration:

- Treat **blank/empty location** as `country_ok = true` (don't drop — many ATS feeds omit location).
- Extend the US regex to also match `"\m(us|usa)\M"` as a standalone word at the end of the string, so `"New York, US"` and `"Remote — US"` pass.
- Leave the explicit non-US case alone (jobs in "Bangalore, India" still drop).

### 4. Trim the generic ATS seed list
File: `src/lib/sources/seed-slugs.ts` — keep slugs that actually post security roles (CrowdStrike, Cloudflare, Palo Alto, Datadog, HashiCorp, Snyk, Wiz, Okta, 1Password, Tailscale, Cisco-Talos via greenhouse where available; drop pure consumer/non-cyber boards like mongodb/roblox/airbnb/mistral that flood your queue).

### 5. Re-run and rescore
After deploy:
- Run `DELETE FROM jobs WHERE matched = false AND scraped_at < now()` to clear the noise.
- Trigger `/api/public/sources/run-tier?tier=hot`, `…?tier=apify`, `…?tier=warm&shard=0` manually so you see fresh, scored, cyber-targeted jobs in minutes.

## Expected outcome
- Apify sources return real LinkedIn/Indeed/Glassdoor postings filtered by `cybersecurity` + `United States` (no manual Apify scheduling needed).
- New cyber-specialist boards feed dozens of relevant matches per run.
- The relaxed country gate stops silently killing US jobs with sloppy location strings.
- Your Jobs page should fill with scored, matched roles within one hot+apify cycle.

Approve and I'll implement.
