# Final Wiring Pass — Sources, Portals, UI

Everything is *almost* connected, but the Sources UI presets and the worker registry have drifted. This plan closes the gaps so every adapter we built is reachable from the UI and every preset has a working adapter behind it.

## Current state (verified)

- ✅ Source registry (`worker/app/sources/registry.py`) imports all 20 scrapers and `run_due_sources` is called from `worker/app/main.py` (scheduler) and `worker/app/cli.py`.
- ✅ Portal registry (`worker/app/apply/portals/registry.py`) imports all 10 apply adapters and is used by `worker/app/apply/runner.py` via `find_portal(job.url)`.
- ✅ Proxy gating (`worker/app/apply/proxy.py`) excludes free-API ATSes from residential-proxy spend.
- ❌ **UI/registry drift in `src/routes/_authenticated/sources.tsx`:**
  - Presets reference 3 adapters that **do not exist** in the worker: `apify_dice`, `adzuna`, `jooble` → enabling them silently no-ops with `no adapter for source key=...` warning.
  - Worker has 6 adapters with **no UI preset**: `apify_google_jobs`, `apify_glassdoor`, `apify_wellfound`, `weworkremotely`, `arbeitnow`, `workatastartup` → user can't enable them without hand-crafting a row.

## Changes

### 1. `src/routes/_authenticated/sources.tsx` — fix presets

- **Remove** 3 broken presets: `apify_dice`, `adzuna`, `jooble`.
- **Add** 6 missing presets so every worker adapter is one click away:
  - `apify_google_jobs` — Google Jobs (Apify), 60 min
  - `apify_glassdoor` — Glassdoor (Apify), 120 min
  - `apify_wellfound` — Wellfound/AngelList (Apify), 180 min
  - `weworkremotely` — We Work Remotely (free RSS), 120 min
  - `arbeitnow` — Arbeitnow (free API), 60 min
  - `workatastartup` — YC Work At A Startup, 240 min
- Group presets in the dropdown by category (Paid Apify / Free APIs / ATS Boards / US Tech) for clarity.

### 2. No worker changes needed

Registries, scheduler hook, apply runner, and proxy gating are already correct — verified by grep.

### 3. Sanity check after edit

- Confirm every `SOURCE_PRESETS[i].key` matches a key in `ADAPTERS` dict in `worker/app/sources/registry.py`.
- Confirm every `Portal.matches()` host pattern is exercised by at least one source (LinkedIn↔apify_linkedin, Greenhouse↔greenhouse_boards, …).

## Out of scope

- No new scrapers or adapters (coverage already at ~93%).
- No DB schema changes.
- No business-logic edits to existing scrapers, apply flows, AI, or notifications.

## Files touched

- `src/routes/_authenticated/sources.tsx` (presets array only)

That's it — one file, one array, brings the UI to 1:1 parity with the worker.
