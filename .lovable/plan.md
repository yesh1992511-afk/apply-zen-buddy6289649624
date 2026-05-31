# Fix "1638 scraped, 0 matched" problem

Doing all three fixes you asked about.

## 1. Immediate unblock (loosen active filter + rescore)

Update the active "Cybersecurity — USA" filter:
- `posted_within_hours`: 24 → 168 (last 7 days)
- `min_score`: 35 → 20

Then run `rescore_all_jobs_for_user` so the existing 1638 jobs get re-evaluated and matches start showing up on the Jobs page right away.

## 2. Diagnosis banner on Jobs page

Add a banner at the top of `src/routes/_authenticated/jobs.tsx` that shows when `scraped > 0` but `matched = 0`:

> "Scraped 1638 jobs but matched 0. Most sources aren't returning security roles. [Loosen filter] [Re-score all jobs] [Disable noisy sources]"

Buttons trigger the same actions inline so the user can self-serve next time without asking.

## 3. One-click "disable noisy sources" on Sources page

Add a button at the top of `src/routes/_authenticated/sources.tsx`:

> "Disable sources that don't pre-filter by keyword"

Disables these for the current user (sets `enabled=false`):
- `arbeitnow`, `weworkremotely`, `usajobs`, `remoteok`
- ATS boards without security focus: `stripe`, `airbnb`, `netflix`, `openai`, `square`, `bosch`

Keeps enabled: security-focused ATS boards and any source the user added manually that does keyword filtering at the source.

## Files touched

- `src/routes/_authenticated/jobs.tsx` — diagnosis banner + action buttons
- `src/routes/_authenticated/sources.tsx` — disable-noisy button
- `src/lib/filters.functions.ts` (or wherever filter mutations live) — small helper to loosen active filter
- DB: one-off UPDATE on the active filter + call `rescore_all_jobs_for_user` (runs once, not a migration)

## Out of scope

- No worker changes
- No new tables
- No scoring algorithm changes
