## Goal

Let you test the full pipeline end-to-end with a small budget: scrape until **N matched jobs** are collected, then stop scraping and **auto-queue applies** for those N jobs in the background.

## How you'll use it

On **Automation → Test Mode** (new card at top):
- Toggle **Test mode** on
- Set **Stop after N matched jobs** (slider 1–10, default 2)
- Pick a source from a dropdown (defaults to first enabled)
- Click **Run test**

The worker will:
1. Scrape that one source, inserting matched jobs one-by-one
2. As soon as N matched jobs exist for this run, stop fetching more
3. Immediately enqueue `apply` commands for those N jobs
4. Surface progress as toasts + a small live status line ("Scraped 2/2 matched · Applying 1/2…")

When the run finishes (or you toggle test mode off), normal scraping/applying resumes.

## Changes

### 1. New `worker_commands` kind: `test_run`
Payload: `{ source_key: string, match_limit: number }`.
Frontend enqueues it via a new `triggerTestRun()` in `src/lib/commands.ts`.

### 2. Worker handler (`worker/app/commands.py` + new `worker/app/test_run.py`)
- Calls `run_source_by_key(source_key)` but passes a `match_limit` through to `_run_source` in `worker/app/sources/registry.py`
- In the insert loop: `if matched_count >= match_limit: break`
- After scraping stops: select the N newly-inserted matched job IDs and insert `applications` rows (status=`queued`) + enqueue one `apply` command per job
- Writes progress into the `worker_commands.result` JSONB so the UI can poll

### 3. UI — `src/routes/_authenticated/automation.tsx`
New `SectionCard` titled **Test Mode** at the top:
- Switch: enable test mode (purely UI state, not persisted)
- `Slider` 1–10 for match limit
- `Select` of user's enabled sources (from `sources` table)
- `Button` "Run test" → calls `triggerTestRun({ source_key, match_limit })`, then polls `waitForCommand(id)` and shows toasts: "Scraping…", "Matched 2/2 — queueing applies", "Test done: 2 queued, see Applications"
- Disabled while a test is running

No schema changes required (reuses `worker_commands`, `jobs`, `applications`).

### 4. Safety
- Test runs ignore `automation_settings.max_applies_per_day` (clearly labeled as "test, bypasses daily cap")
- Hard cap: `match_limit` clamped to 10
- Stops on first error and reports it in the toast

## Files

- `worker/app/commands.py` — dispatch `test_run`
- `worker/app/test_run.py` — new orchestrator
- `worker/app/sources/registry.py` — add optional `match_limit` to `_run_source` / `run_source_by_key`
- `src/lib/commands.ts` — add `triggerTestRun` + `Kind` union entry
- `src/routes/_authenticated/automation.tsx` — add Test Mode card
- `src/lib/queries/automation.ts` (only if needed for sources list — likely reuses existing query)

## Out of scope

- No new tables, no migrations, no changes to filter scoring or apply portals.
