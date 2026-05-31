
# Jobs page: only show matched jobs

The jobs query currently returns every row in `jobs` — including `status='discarded'` rows that failed the filters. Restrict it to matched jobs only.

## Changes (`src/lib/queries/jobs.ts`)

1. **`jobsQueryOptions`** — add `.eq("matched", true)` to the select so unmatched/discarded jobs are excluded.

2. **`jobCountsQueryOptions`** — return real counts:
   - `scraped` = total rows for user
   - `matched` = rows where `matched = true`
   (Two parallel `head:true` count queries.)

No schema / worker changes. UI stays as-is.
