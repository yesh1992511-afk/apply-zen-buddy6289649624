# Full system audit — findings + fix plan

Audited profile completeness, sources, auto-apply pipeline, and cross-page sync. Real issues found in all four areas. Doing everything in one shot is risky — proposing 4 phases, ship in order.

## Phase 1 — Critical correctness fixes (do first)

**Apply pipeline reliability**
- **PDF fallback**: worker currently throws `RuntimeError` if no `.tex` template is set (`resume_pipeline.py:28`). Add fallback: if no tex template, use the user's default uploaded PDF as-is. Unblocks anyone who hasn't authored a LaTeX resume.
- **Auto-retry with backoff**: `applications` table already has `retry_count` and `next_retry_at`. Wire exponential backoff (1m → 5m → 30m, cap 3) in worker `commands.py` on transient failures.
- **Worker concurrency honors settings**: remove hard cap of 2 in `runner.py:158`; use `automation_settings.parallelism` directly.

**Profile data integrity**
- Add **`is_current` toggle** to Experience rows (DB column exists, no UI).
- Fix **silent save** on Experience/Education/Skills/Certs/Languages/Projects/References: route through the same `useProfileEditor` saved-indicator pattern as the main profile.
- Stop auto-creating `"New company"` / `"New school"` placeholder rows — require at least one filled field before insert (`profile.tsx:593`).
- Fix onboarding gate (`onboarding.tsx:42`): accept `work_auth_country` OR `work_authorization` instead of just the latter.

**Sources noise**
- Fix `jobTarget.ts` keyword mapping: BuiltIn excluded from `standardKey` (line 102); RemoteOK over-splits multi-word keywords (line 113); USAJobs only sends first keyword (line 118). Fix all three so user keywords actually reach the source.
- Disable BuiltIn/Arbeitnow/WeWorkRemotely by default in the seed preset (keep them removable but off).

## Phase 2 — MNC-grade profile fields

Add to DB + UI (one migration + profile.tsx additions):
- **Compliance**: `consent_background_check` (bool), `criminal_record_disclosure` (enum: none/disclosed/decline-to-answer), `consent_drug_test` (bool)
- **Availability**: `notice_period_category` (immediate/2wks/1mo/2mo/3mo/other) alongside existing weeks field
- **Relocation/Travel**: `relocation_assistance_needed` (bool), `travel_willingness_pct` (0/25/50/75/100)
- **References on demand**: `references_available_on_request` (bool)
- **Global work auth**: relabel section to "Work authorization" (not "U.S."), already supports `authorized_countries` array — just surface it
- **Demographics (EEOC)**: ensure existing fields (gender/ethnicity/veteran/disability/lgbtq) have the standard ATS dropdowns + the legally required "decline to answer" option

## Phase 3 — Free job source additions (cybersecurity USA focus)

Add 3 high-signal free sources to `worker/app/sources/`:
- **Hacker News "Who is Hiring"** via Algolia HN Search API (no key, monthly thread, filters by keyword cleanly)
- **infosec-jobs.com** (niche security board, public JSON feed)
- **Hacker News Algolia jobs index** as a second backstop

Register them in `registry.py` + `curated-packs.ts` + `sources.tsx` PRESETS. Each pre-filters by keyword at source.

## Phase 4 — Cross-page sync & UX consistency

- **Convert Dashboard + Applications to useQuery** with shared query keys so mutations on Jobs page update both immediately (no more split-brain).
- **Realtime on `automation_runs`** for live scrape progress on Dashboard + Worker pages.
- **Wire notification triggers**: server cron / worker hook that calls `sendUserEmailRaw` for high-score jobs, apply failures, and worker-offline (UI toggles exist, no firing code).
- **Server-side quota enforcement**: `enforce_apply_quota` trigger exists in DB but `useApplyToJob` doesn't surface the rejection cleanly — add toast + disable when at cap.
- Loading skeletons on `Filters`, `Billing`, `Setup`, `Resume` (replace `"Loading..."` strings).

## Out of scope (call out, defer)

- LLM-based dynamic screening answer engine (Phase 3 in apply audit) — large surface area, deserves its own pass.
- iCIMS/Taleo/BambooHR portal adapters — each is a multi-day build.
- Dice/ClearanceJobs/NinjaJobs — require scraping with anti-bot handling, not free APIs.
- Stripe billing wiring beyond what's already there.

## How to proceed

Phase 1 is ~6 file changes + 1 migration, low risk, immediately user-visible. I recommend shipping **Phase 1 now**, then asking you whether to continue with 2/3/4 (each phase is 30-60 min of work).

**Reply with**: `phase 1` to ship just the critical fixes, `phase 1+2` to also add the MNC profile fields, or `all` to do everything in sequence.
