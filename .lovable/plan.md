# Phase 2b — Frontend Polish: Jobs, Applications, Sources, Settings

Build on the Phase 2a foundation (TanStack Query + autosave). Apply the same patterns across the remaining user-facing routes so the whole app behaves consistently — caches refresh, mutations invalidate, errors surface, mobile works.

## 1. Shared query layer (extend `src/lib/queries/`)
- `jobs.ts` — `jobsQueryOptions({ hours, filterId })` keyed on params; `useApplyToJob()` and `useBulkQueueApplies()` mutations.
- `applications.ts` — `applicationsListQueryOptions()`, `applicationQueryOptions(id)`, `applicationEventsQueryOptions(id)`, `useRetryApplication()`.
- `sources.ts` — `sourcesQueryOptions()`, `useToggleSource()`, `useTestSource()`.
- `settings.ts` — automation/notifications/gmail mutations.
- All wrap existing `supabase.from(...)` calls; all mutations call `queryClient.invalidateQueries` so lists refresh without page reload.

## 2. Jobs (`/jobs`)
- Migrate `useEffect` + `useState` to `useQuery(jobsQueryOptions)` — current load function is `setLoading(true) → fetch → setLoading(false)`, which flashes and races.
- Move `hours` / `search` / `activeFilterId` to URL search params (`validateSearch` + `Route.useSearch`) — shareable links + back button works.
- "Apply" button uses `useMutation` so it disables itself + invalidates the list on success; replace the manual `applyingId` state.
- Empty / error states unified with `<EmptyState>` and a new `<QueryErrorState>` (one place to retry).
- **Virtualization deferred** — current card grid (max 200 rows) doesn't need it; revisit if users hit the limit.

## 3. Applications (`/applications` + `/applications/$id`)
- List: convert to `useQuery` keyed on phase; realtime hook stays but calls `queryClient.invalidateQueries` instead of refetching manually.
- Detail page: add a **timeline section** built from `application_events` (phase, ts, message, screenshot thumb) with a click-to-zoom lightbox.
- New "Retry now" button on `failed` / `needs_review` rows → mutation that sets `next_retry_at = now()`, resets `last_error`, invalidates query.
- Show `dlq_reason` clearly when an application is dead-lettered, with a "Reset attempts" action.

## 4. Sources (`/sources`)
- Health badge per row:
  - green dot if `last_run_status='ok'` and `last_run_at` within `cadence_minutes × 2`,
  - amber if stale,
  - red if `last_error` set or `last_run_status='error'`.
- Expandable error panel with `last_error` and copy-to-clipboard.
- "Test" button shows inline result (count + duration) instead of toast-only.
- Move the auto-seed effect into a one-time mutation guarded by query data, not a stateful effect.

## 5. Settings cluster (automation / notifications / filters / gmail)
- Add Zod schemas next to each form; inline `<FieldError>` under offending field.
- Convert single Save buttons to autosave-per-section using the Phase 2a `useDebouncedCallback` (consistent UX with Profile).
- Gmail credentials: new "Verify" mutation that hits a `verifyGmailCredentials` server fn (calls SMTP login) and writes `verified_at` / `last_error` — UI shows green check or red error inline.

## 6. Cross-cutting polish
- **Toast helpers** (`src/lib/toast.ts`): `toastSaved()`, `toastError(err)`, `toastQueued(n)` — one place to control copy and tone. Replace ad-hoc `toast.success/error` calls.
- **Unified skeletons**: every list/card route uses the existing `skeletons.tsx` primitives — kill remaining inline `shimmer` divs.
- **Mobile pass** (≤ md): sidebar already collapses; verify forms stack to 1 column, sticky filter bars don't overflow, tap targets ≥ 44px.
- **QueryErrorState** component: shared error UI with retry button — used by jobs/applications/sources error branches.

## Technical notes

- Realtime: keep `useRealtimeInvalidate`, but change its callback to `queryClient.invalidateQueries({ queryKey })` instead of bespoke `load()` per route — fewer redundant fetches.
- URL search params on Jobs need `@tanstack/zod-adapter` (already a transitive dep via @tanstack/router; verify on first use, install if missing).
- No DB migrations. No new server fns except `verifyGmailCredentials`.

## Out of scope (Phase 3+)

- Backend RLS audit, Zod on all server fns, indexes.
- Worker queue claim/lease pattern.
- Extension token rotation.

## Approval

Reply **"go"** to execute Phase 2b end-to-end. Order:
1. Shared query layer + helpers (`toast.ts`, `QueryErrorState`)
2. Jobs migration
3. Applications list + detail (timeline + retry)
4. Sources health UI
5. Settings autosave + Gmail verify
6. Mobile + skeleton sweep
