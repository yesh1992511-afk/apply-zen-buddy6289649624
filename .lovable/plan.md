## What's wrong on /sources

After auditing the Sources page (`src/routes/_authenticated/sources.tsx`), the worker registry (`worker/app/sources/`), and the `sources` / `run_status` schema, the page has four real problems — most of what you're seeing as "Failing" is actually working code being mislabelled or running under the wrong key.

### 1. Health badge is wrong for every successful source

UI considers a run healthy only when `last_run_status === "ok" | "success"`, but the worker writes `"success"` / `"partial"` / `"failed"` and the DB enum also contains `"succeeded"` (legacy). Existing rows show `succeeded` → UI paints them red as "Failing" even with 96–160 jobs imported.

Fix: treat `"success" | "succeeded" | "ok"` as healthy. Drop `"succeeded"` from the enum later via migration after backfilling rows to `"success"`.

### 2. Duplicate source rows (colon vs underscore keys)

The DB has two parallel sets of rows for the same portal:

- Worker (Python) adapters use colon keys: `apify:linkedin`, `apify:glassdoor`, `apify:google_jobs`, `usajobs`, `greenhouse_boards`, …
- The `PRESETS` array in `sources.tsx` (and the older `src/lib/sources/adapters.server.ts`) uses underscore keys: `apify_linkedin`, `apify_glassdoor`, `apify_google_jobs`, …

Result: every Apify portal appears twice — once running (colon, often failing or 0 jobs) and once "Idle / Never run yet" (underscore, because no adapter matches that key). Clicking Run on the underscore row does nothing.

Fix: standardise on the worker's colon keys. Update `PRESETS` to match adapter keys (`apify:linkedin`, `apify:glassdoor`, `apify:google_jobs`, `apify:indeed`, `apify:ziprecruiter`, `apify:wellfound`, `usajobs`, `greenhouse_boards`, `lever_boards`, `ashby_boards`, `workable_boards`, `smartrecruiters_boards`, `recruitee_boards`, `teamtailor_boards`, `workday_boards`, `bamboohr_boards`, `personio_boards`, `breezyhr_boards`, `jobvite_boards`, `icims_boards`, `infosec_jobs`, `hn_jobs`, `hn_who_is_hiring`, `workatastartup`, plus the new `dice`, `cybersecjobs`, `cleared_jobs`, `levelsfyi`, `ycombinator_jobs`). Add a one-shot migration that:
  - Merges any underscore-key row into the matching colon-key row for the same user (preserve enabled / cadence / config; delete the underscore row).
  - Renames legacy `usajobs:*` sub-keys (`usajobs:cyber/data/engineer/software`) into a single `usajobs` row with `config.queries = [cyber, data, engineer, software]` so they aren't run four times.

After this, the page shows one row per source and "Run now" works for all of them.

### 3. Concrete adapter errors visible today

- `apify:glassdoor` → `403 Forbidden` on `bebity~glassdoor-jobs-scraper`. That actor is paid/restricted on the workspace's Apify token. Swap the default actor in `apify_glassdoor.py` to a free public Glassdoor actor and surface a clearer "set APIFY_TOKEN with access to this actor" message when 401/403 hits. (No new secret prompt — keep using the existing `APIFY_TOKEN`.)
- `himalayas` → `RangeError: Invalid time value`. That string is coming from the UI's `timeAgo(last_run_at)` when `last_run_at` parses to `Invalid Date` (some legacy rows are stored as `0001-01-01` / empty strings). Harden `timeAgo` in `sources.tsx` to return `"—"` on `Number.isNaN(d.getTime())` and stop storing the error string in `last_error` for that case.
- `usajobs:software` shows 0 jobs even though `cyber/data/engineer` return 96–100. After consolidating into the single `usajobs` source per fix #2, the worker already loops the four query terms — the 0-row "software" case disappears.

### 4. Apify Run now silently no-ops without `APIFY_TOKEN`

Today the adapter just throws a raw `httpx` 401/403 buried in `last_error`. Add a pre-flight check in `worker/app/sources/_http.py` (or a tiny helper in each apify adapter) that, when `APIFY_TOKEN` is missing, writes `last_run_status = "failed"`, `last_error = "APIFY_TOKEN not set — open Settings → Secrets"` and returns immediately. The Sources page already shows `last_error` in a copy-able panel, so the user gets a clear next step.

## Out of scope (won't touch this turn)

- The duplicate adapter file `src/lib/sources/adapters.server.ts` (the older TanStack server-fn scrapers). It is no longer the path of truth — the worker is. I'll leave it in place but note it as dead code; removing it is a separate cleanup.
- Curated company packs ("Top Tech", "AI / ML", etc.) and the Job Target panel — they already work against the colon keys after fix #2; no UI changes needed.
- Re-running historical scrapes / backfilling missed jobs.

## Technical details (for the implementation pass)

Files touched:

- `src/routes/_authenticated/sources.tsx`
  - `statusOk` accepts `"success" | "succeeded" | "ok"`.
  - Replace `PRESETS` keys with the worker's colon/underscore canonical keys listed above; keep `display_name` and `kind` as-is.
  - Harden `timeAgo()` against invalid dates.
- `worker/app/sources/apify_glassdoor.py` — swap default actor to a free one; richer error string on 401/403.
- `worker/app/sources/_http.py` — central `require_apify_token()` helper used by every `apify_*.py` adapter.
- Migration `supabase/migrations/<ts>_sources_key_consolidation.sql`:
  ```sql
  -- 1. Backfill legacy run_status values
  update public.sources set last_run_status = 'success' where last_run_status = 'succeeded';

  -- 2. Map underscore → colon for apify sources, preferring the colon row if both exist
  with conflicts as (
    select u.id as und_id, c.id as col_id, u.user_id
    from public.sources u
    join public.sources c
      on c.user_id = u.user_id
     and c.key = replace(u.key, 'apify_', 'apify:')
    where u.key like 'apify\_%'
  )
  delete from public.sources s using conflicts c where s.id = c.und_id;

  update public.sources
     set key = replace(key, 'apify_', 'apify:')
   where key like 'apify\_%';

  -- 3. Collapse usajobs:* sub-rows into a single 'usajobs' source per user
  -- (merge config.queries arrays, keep max cadence, OR enabled, delete sub-rows)
  -- … done with a CTE + insert-on-conflict-do-update; full body in the migration.
  ```

No schema changes to `run_status` itself this turn (safer to leave the legacy enum value and just stop writing it). New `add_secret` calls: none.

## Acceptance check

After implementation:

- Every successful source on `/sources` shows a green "Healthy" badge (no more red "Failing" on rows that have job counts).
- Each portal appears exactly once.
- Apify rows without `APIFY_TOKEN` show "APIFY_TOKEN not set" in the error panel instead of an httpx 401/403 dump.
- `himalayas` row no longer shows `RangeError: Invalid time value`.
- "Run now" on every preset row triggers an actual scrape.
