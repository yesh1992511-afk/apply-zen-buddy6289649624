# Phase 2 — Frontend User-Side Upgrade

Goal: profile, jobs, applications, sources, settings feel premium and **never break**. Replace the ad-hoc `useEffect + supabase.from()` pattern with TanStack Query for caching, loading, and refetching — across 12 routes.

## What changes

### 1. Data layer (foundation for the rest)
- Add shared `queryOptions` factories in `src/lib/queries/` per domain: `profile`, `jobs`, `applications`, `sources`, `automation`, `notifications`, `filters`, `worker`, `logs`.
- Each wraps `supabase.from(...)` calls (or existing server fns) with stable query keys.
- Mutations become `useMutation` + `queryClient.invalidateQueries` — no more "save then reload page".
- Add a small `useDirtyGuard()` hook for unsaved-changes warning.

### 2. Profile (`/profile`, 890 lines → split)
- Break the mega-form into a tabbed layout: **Personal · Address · Work Auth · Preferences · Demographics · Links · Screening**.
- Zod schema **per section** with inline field errors.
- **Autosave per section** (debounced 800 ms) with a "Saved · just now" indicator; remove the giant single Save button. Manual "Save now" still available per section.
- Dirty-state guard on tab switch + browser unload.
- Fixes the visa-status bug class permanently (each field is a controlled `useMutation`, no shared state-merge race).

### 3. Jobs (`/jobs`)
- Filter chip bar (matched / discarded / new / status) above list.
- Score badge with color from token (`success` / `warning` / `destructive`).
- Empty state when no matches.
- Bulk actions: select rows → "Queue apply" / "Discard".
- Keyboard: `j/k` navigate, `a` apply, `d` discard, `/` focus search.
- Virtualized list (`@tanstack/react-virtual`) so 1000+ rows stay smooth.

### 4. Applications (`/applications` + `/applications/$id`)
- List: status filter chips, retry button per row for failed/DLQ rows.
- Detail page: **timeline view** built from `application_events` (phase + ts + message).
- Screenshots gallery → click for lightbox.
- "Retry now" button that mutates `applications.next_retry_at = now()` and invalidates the query.

### 5. Sources (`/sources`)
- Connection health badge per row (green if `last_run_status='ok'` and `last_run_at` < cadence, amber if stale, red if `last_error`).
- Inline "Test run" button (writes to `worker_commands` kind=`test_source`).
- Expandable error panel showing `last_error` with copy-to-clipboard.

### 6. Settings cluster (automation / notifications / filters / gmail credentials)
- Zod-validated forms with inline errors (currently most are silent on bad input).
- "Verify" button on Gmail credentials → server fn that attempts SMTP login and updates `verified_at` / `last_error`.
- Notification settings: live preview of the daily-summary recipient row.

### 7. Global UX polish (cross-cutting)
- Replace all spinner placeholders with skeletons that match the final layout (use existing `skeletons.tsx`).
- Mobile pass: sidebar collapses on `< md`, forms stack, tables become cards.
- Toast pattern unified (`sonner`): one helper `toast.success/error` with consistent copy ("Saved", "Couldn't save — try again").

## Technical notes (for the technical reader)

- `defaultPreloadStaleTime: 0` already set — verify in `src/router.tsx`; add if missing.
- Query keys: `["profile", userId]`, `["jobs", { status, filter }]`, `["application", id]`, etc.
- For RLS-scoped reads we keep using the browser `supabase` client (already user-scoped). No new server fns required for Phase 2 reads — mutations stay as-is.
- Auto-save debounce uses `useDebouncedCallback` (lodash already a transitive dep, or inline 8-line hook).

## What's NOT in this phase
- Backend hardening (Zod on server fns, retry policy, indexes) → Phase 3.
- Worker queue claim/lease, extension token rotation → Phase 5.

## Approval

Reply **"go"** and I'll execute Phase 2 end-to-end. Order: data layer → profile (biggest win) → jobs → applications → sources → settings → polish.
