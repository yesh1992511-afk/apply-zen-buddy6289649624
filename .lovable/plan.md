# Plan: ship Phases 2 + 3 + 4

Phase 1 already landed (PDF fallback, parallelism, keyword mapping, is_current, onboarding gate, noisy sources off). This plan finishes the audit.

## Phase 2 — MNC-grade profile fields

**One migration** adds these columns to `public.profile`:
- `consent_background_check` boolean default false
- `consent_drug_test` boolean default false
- `criminal_record_disclosure` text (`none` | `disclosed` | `decline`)
- `notice_period_category` text (`immediate` | `2w` | `1m` | `2m` | `3m` | `other`)
- `relocation_assistance_needed` boolean default false
- `travel_willingness_pct` integer (0/25/50/75/100)
- `references_available_on_request` boolean default true

**Profile UI (`src/routes/_authenticated/profile.tsx`)**:
- New "Compliance & Availability" section with the new fields
- Rename "U.S. Work Authorization" → "Work Authorization", surface `authorized_countries` as a multi-chip input
- EEOC dropdowns: ensure each demographic field offers the standard ATS options + "Decline to answer"
- All fields wired through `useProfileEditor` so they save + show the saved indicator

**Profile-map (`worker/app/apply/profile_map.py`)**: expose new fields to the form walker so ATS questions about background check / notice / relocation / travel auto-fill.

## Phase 3 — Free job sources (cyber-USA focus)

Three new adapter files under `worker/app/sources/`:
- `hn_who_is_hiring.py` — Algolia HN Search API, monthly "Ask HN: Who is hiring?" thread, keyword-filtered comments
- `infosec_jobs.py` — infosec-jobs.com public JSON feed
- `hn_jobs.py` — Algolia HN jobs index as a backstop

Register each in:
- `worker/app/sources/registry.py`
- `src/lib/sources/curated-packs.ts` (add to Cybersecurity pack)
- `src/routes/_authenticated/sources.tsx` PRESETS

Each source pre-filters by user keywords at fetch time to avoid noise.

## Phase 4 — Cross-page sync & UX

**Shared query keys**: convert `dashboard.tsx` and `applications.tsx` to `useQuery` against the same keys used by `jobs.tsx` so mutations propagate without manual refresh.

**Realtime**:
- Subscribe to `automation_runs` on Dashboard + Worker pages for live scrape progress
- Reuse existing `useRealtimeInvalidate` hook pattern

**Notification firing**:
- Add hook in worker `apply/runner.py` to call `notify.apply_failed` on terminal failure (after retries exhausted)
- Add hook in `pipeline/filter_engine.py` (or after `match_job_to_filters`) to call `notify.high_score`
- Daily summary already cron-wired; verify

**Quota enforcement UX**:
- `useApplyToJob` in `src/lib/queries/applications.ts` catches `check_violation` Postgres error and shows a clear toast "Daily apply cap reached — upgrade plan or wait until tomorrow"
- Disable Apply button when at cap (cheap count query)

**Loading polish**: replace `"Loading..."` strings in Filters, Billing, Setup, Resume with skeletons from `src/components/skeletons.tsx`.

## Out of scope (explicitly deferred)

- LLM dynamic screening answer engine
- iCIMS / Taleo / BambooHR portal adapters
- Dice / ClearanceJobs / NinjaJobs (anti-bot)
- Stripe billing changes beyond what exists

## Order of execution

1. Phase 2 migration → wait for approval → UI + profile_map
2. Phase 3 sources (no migration needed)
3. Phase 4 sync + notifications + quota + skeletons

Estimated ~15 file edits + 1 migration. After each phase I'll verify build, then move to the next.

Reply **approve** to start with the Phase 2 migration.
