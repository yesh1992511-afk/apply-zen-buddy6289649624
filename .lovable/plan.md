## Phase A — Remaining Cleanup & Verification

Investigation shows Phase A is **95% wired correctly**:
- `source.hot` cron is firing every 15min and writing `automation_runs` rows ✅
- Adapters return 344 jobs/run, dedupe correctly on subsequent runs ✅
- `sources` health table being upserted by `run-tier.ts` ✅
- `/worker` UI filters by `kind LIKE 'source.%'` ✅

But three issues remain:

### 1. Duplicate cron jobs (causes double work & race conditions)

The database has **3 overlapping hot-tier jobs** and **9 warm-tier jobs** that all hit `/run-tier`:

| Duplicate group | Jobs |
|---|---|
| Hot (3×) | `scrape-hot`, `sources-hot-15min`, `sources-hot-tier` |
| Warm shard 0 (3×) | `scrape-warm-0`, `sources-warm-shard-0`, `sources-warm-shard0` |
| Warm shard 1–3 (2× each) | `scrape-warm-{1,2,3}` + `sources-warm-shard-{1,2,3}` |

**Fix:** Drop the redundant `scrape-*` and `sources-hot-15min` / `sources-warm-shard0` jobs. Keep one canonical set:
- `sources-hot-tier` (every 15min)
- `sources-warm-shard-{0..3}` (staggered :00/:15/:30/:45)
- `scrape-usajobs` (every hour at :25)
- `scrape-apify` (every 4h)

### 2. Untested tiers (warm/usajobs/apify never invoked)

`sources` table shows `last_run_at = NULL` for every ATS board, USAJobs, and Apify source. Adapters could silently throw on first run.

**Fix:** Manually invoke each tier once via `stack_modern--invoke-server-function` to validate:
- `?tier=warm&shard=0` → expect ATS slugs to fetch
- `?tier=usajobs` → expect federal jobs (needs USAJOBS_API_KEY ✅ already set)
- `?tier=apify` → expect cached datasets from APIFY_TOKEN ✅

Fix any failures surfaced (most likely adapter quirks in `adapters.server.ts`).

### 3. Errors array always empty in metadata

`automation_runs.metadata.errors` shows `[]` even when `errors:1`. The filter logic in `run-tier.ts:207` runs before all chunks finish counting. Minor — improves debuggability.

**Fix:** Move metadata error array construction after the per-source loop completes (it already does — actual bug: `summary[sourceKey].error_message` is only set inside the timeout-rejected branch, not the per-chunk insert-error branch). Add `error_message` capture in the chunk-error branch.

---

### Technical changes

1. **SQL migration** — `cron.unschedule()` the 6 duplicate jobs.
2. **`src/routes/api/public/sources/run-tier.ts`** — set `summary[sourceKey].error_message` on chunk insert errors too.
3. **Verification** — call `/api/public/sources/run-tier?tier=warm&shard=0`, `?tier=usajobs`, `?tier=apify` against the published URL and inspect responses + new `sources` rows.

No UI changes. No schema changes. No new secrets needed.