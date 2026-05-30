## Problem

Today every source preset is hard-coded to search `"software engineer"` in `United States` (`src/routes/_authenticated/sources.tsx` lines 47–68). When a user enables sources, they scrape software jobs regardless of their target field. The only way to change keywords today is to edit each source's JSON config one-by-one in the Sources page, which is tedious and easy to get wrong because every scraper uses a different field name (`searchTerms`, `position`, `keyword`, `queries`, `search`, `keywords`, etc.).

The user wants one place to set "I want **cybersecurity** jobs in the **USA**" and have every source + the matching filter respect it.

## What we'll build

### 1. "Job Target" picker on the Sources page (top of page)

A new card above the "Auto job ingestion" panel:

- **Field**: dropdown of presets (Software Engineering, Cybersecurity, Data / ML, Product, Marketing, Sales, Custom)
- **Titles / keywords**: comma-separated list (prefilled per preset, e.g. for Cybersecurity: `security engineer, cybersecurity, SOC analyst, security analyst, penetration tester, pentester, application security, appsec, cloud security, IAM, GRC, SIEM, incident response, threat intel, vulnerability, red team, blue team`)
- **Location**: text input, default `United States`
- **Country code**: `US` (used by Indeed/Glassdoor)
- **Posted within**: `24h / 7d / 30d`
- **Exclude keywords**: prefilled per preset (for Cybersecurity: `sales, marketing, recruiter, intern, physical security, security guard, janitor`)
- Button: **Apply to all sources + default filter**

When clicked, it:
1. Rewrites the `config` JSON of every existing `sources` row owned by the user, mapping the chosen titles into each source's field name (the mapping is the same one the worker reads — see code map below).
2. Updates the user's default `filters` row with `keywords`, `exclude_keywords`, `locations: ["United States"]`, `posted_within_hours`, sensible `min_score` (e.g. 35 so we don't drop everything).
3. Persists the chosen target in `automation_settings` (new column) so reseeding later reuses it instead of falling back to "software engineer".
4. Shows a toast and offers a "Run now" button.

### 2. Replace hard-coded "software engineer" in PRESETS

Change the `PRESETS` array in `sources.tsx` from literal `"software engineer"` strings to be built from the saved Job Target (or fall back to the first onboarding desired title). New users who hit the auto-seed path (lines 90–116) will get sources pre-configured to their target instead of to software engineering.

### 3. Small DB addition

Add columns to `automation_settings` so the target is persisted per user:

- `target_titles text[]` (e.g. `{cybersecurity, SOC analyst, ...}`)
- `target_locations text[]` (e.g. `{United States}`)
- `target_country text` (e.g. `US`)
- `target_posted_within_hours int` default `168`
- `target_exclude_keywords text[]`

(No new table, no RLS changes — `automation_settings` already has owner-only RLS.)

### 4. One-time backfill for the current user

After the user approves, also run a data update that immediately:
- Sets their Job Target to Cybersecurity / USA.
- Rewrites all their existing source configs.
- Updates (or creates) their default filter with the cyber keywords + exclusions.

So the next ingestion run returns cybersecurity jobs without them having to click anything.

## How the keyword mapping works (technical)

Each scraper expects a different JSON shape. The applicator will write the chosen titles into the right key for each `source.key`:

```text
apify_linkedin          → searchTerms: titles,   locations: [location],     publishedAt: "r{seconds}"
apify_indeed            → position: titles[0],   country: countryCode
apify_ziprecruiter      → search: titles[0]
apify_glassdoor         → keyword: titles[0],    location
apify_google_jobs       → queries: titles,       location
apify_wellfound         → keywords: titles
remoteok                → keywords: titles
remotive                → search: titles[0]
builtin                 → queries: titles,       locations
workatastartup          → keywords: titles
usajobs                 → keyword: titles[0]
weworkremotely / arbeitnow / ATS boards → leave config alone (no keyword param)
```

`maxItems`, `cadence_minutes`, `actor_id`, company lists for ATS boards, etc. are preserved.

## Files touched

- `src/routes/_authenticated/sources.tsx` — add Job Target card + `applyJobTarget(target)` helper that batch-updates sources and the default filter; refactor PRESETS to be a function of the saved target.
- `src/lib/jobTarget.ts` *(new)* — preset list (Software, Cybersecurity, Data/ML, Product, Marketing, Sales, Custom) and the per-source config-mapping function.
- `supabase/migrations/...` — add 5 columns to `automation_settings`.
- One-time `update` to set the current user's target to Cybersecurity / USA and rewrite their existing sources + default filter.

## Out of scope

- Server-side re-scoring of jobs already in the table (existing rows will keep their old `score` / `matched`; new scrapes will be cybersecurity). If you want, I can add a "Re-match existing jobs" button that calls the existing `match_job_to_filters` function for every job — say the word.
- Per-source overrides (you'd still be able to hand-edit the JSON for a single source if you want a different keyword on, say, Indeed).
