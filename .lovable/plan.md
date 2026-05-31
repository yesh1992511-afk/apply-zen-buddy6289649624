# Finish remaining items

## A. Profile: show input boxes immediately for Experience / Projects / Certifications

Today the Experience, Projects, and Certifications tabs render only an "Add" button when the list is empty — no input fields visible. Users can't see what to fill in.

**Fix in `src/routes/_authenticated/profile.tsx` (`ListSection`)**:
- After `load()` returns `data`, if `data.length === 0` for `experiences`, `projects`, or `certifications`, auto-insert one blank starter row so the field grid (company/title/dates/bullets/tech, or name/url/description, or name/issuer/dates) is visible.
- Apply only the first time the tab loads (track with a ref keyed by table name so we don't loop-insert).
- Same gentle empty-state for `educations`, `skills`, `languages`, `references_list` — auto-seed one blank row so every tab presents fillable boxes.

No schema change — the SCHEMAS already define the right inputs; we just need to make sure at least one editable card is present.

## B. Phase 4 — remaining sync/UX polish

1. **Disable Apply button at daily cap**
   - In `src/lib/queries/jobs.ts`, add `useDailyApplyBudget()` returning `{ used, cap, atCap }` from `usage_quotas` (today) + `automation_settings.max_applies_per_day`.
   - In `src/routes/_authenticated/jobs.tsx`, disable the Apply / Bulk-Queue buttons and show a tooltip "Daily apply cap reached" when `atCap`.

2. **Loading skeletons** — replace literal `"Loading..."` strings with `<Skeleton />` from `src/components/skeletons.tsx` in:
   - `src/routes/_authenticated/billing.tsx`
   - `src/routes/_authenticated/automation.tsx` (settings load state)
   - `src/routes/_authenticated/dashboard.tsx` (KPI tiles before first paint)
   - any other `_authenticated/*` route still showing the string.

3. **Cross-page mutation sync** — audit `dashboard.tsx` and `applications.tsx`; ensure their queries use the same query keys as `jobs.ts` (`['applications', userId]`, `['dashboard', userId]`) so `useApplyToJob` invalidations already wired in Phase 4 propagate without manual refresh. Fix any mismatched keys.

## Out of scope
- New backend tables / migrations (none needed)
- New job sources (Phase 3 done)
- Worker changes (Phase 1–4 worker edits already shipped)

## Files touched
- `src/routes/_authenticated/profile.tsx` (auto-seed empty rows)
- `src/lib/queries/jobs.ts` (+ daily budget hook)
- `src/routes/_authenticated/jobs.tsx` (disable at cap)
- `src/routes/_authenticated/billing.tsx`, `automation.tsx`, `dashboard.tsx`, `applications.tsx` (skeletons + query-key alignment)

Reply **approve** to implement.
