# Whole-System Upgrade — Phased Plan

Goal: premium look, zero broken states, production-safe backend, reliable worker + extension. We ship **one phase per turn** so each lands clean and you can verify before the next.

---

## Phase 1 — Foundation: design system + global UX safety net
*The base everything else sits on. Do this first or polish keeps drifting.*

- Audit `src/styles.css` tokens — lock semantic colors (background, surface, primary, muted, destructive, success, warning), spacing scale, radius, shadows, gradients. Remove any hardcoded `text-white` / `bg-black` in components.
- Global primitives: consistent `<PageHeader>`, `<EmptyState>`, `<LoadingSkeleton>`, `<ErrorState>`, `<ConfirmDialog>`, toast patterns.
- Add a top-level **ErrorBoundary** + per-route `errorComponent` + `notFoundComponent` on every authenticated route (today most are missing).
- Replace ad-hoc spinners with skeletons that match final layout.
- Mobile pass on sidebar + profile + jobs + applications.
- Accessibility: focus rings, aria-labels on icon buttons, form labels, color-contrast check.

## Phase 2 — Frontend user side (profile, jobs, applications, sources, settings)
- **Profile**: split mega-form into tabbed sections (Personal · Work Auth · Preferences · Demographics · Links · Screening). Zod validation per section, dirty-state tracking, "unsaved changes" guard, autosave per section instead of one giant save.
- **Jobs**: filter chips, score badge, virtualized list, bulk actions (discard, queue apply), keyboard shortcuts.
- **Applications**: timeline view per app with `application_events`, retry button (calls server fn), screenshots lightbox, status filters.
- **Sources**: connection health badge, last-run summary, test-run button, clear error surfacing.
- **Settings**: automation, notifications, secrets, Gmail credentials — all with inline validation + verify buttons.
- TanStack Query everywhere with `queryOptions` + suspense; remove `useEffect`+`fetch` patterns.

## Phase 3 — Backend hardening (DB + server functions)
- **RLS audit** on all 30+ tables (already mostly owner-scoped — verify nothing leaks via joins).
- **Zod input validators** on every `createServerFn` (currently many are unchecked).
- **Indexes** on hot paths: `jobs(user_id, status, created_at)`, `applications(user_id, status, queued_at)`, `application_events(application_id, ts)`, `logs(user_id, ts)`, `worker_commands(user_id, status)`.
- **Idempotency** on applications insert + worker_commands (key already on table — enforce in code).
- **Retry policy** on `applications`: exponential backoff via `next_retry_at`, max attempts, move to DLQ status with reason.
- **Audit log** writes on every mutation (profile changes, settings, source toggles, manual apply).
- **Rate limits** per user on apply queue + AI calls using `usage_quotas`.
- **Validation triggers** (not CHECK) for new business rules.

## Phase 4 — Server side / observability
- Centralized error middleware on all server fns → write to `error_events` with fingerprint dedupe.
- Structured logging helper → `logs` table with scope/level/metadata.
- Health endpoint at `/api/public/health` (DB ping + worker heartbeat freshness).
- Webhook signature verification pattern for any inbound `/api/public/*`.
- Background job: nightly cleanup of old `logs`, `application_events`, expired `extension_tokens`.
- Daily summary email job (table already exists, wire it).
- Worker heartbeat staleness alert → notification when `last_seen` > N minutes.

## Phase 5 — Chrome extension + worker reliability
- Extension token rotation UI + revoke button; per-token capture quota enforcement.
- Capture flow: retry with backoff, dedupe via `dedupe_hash`, surface errors to user dashboard.
- Worker command queue: heartbeat + claim/lease pattern so a crashed worker doesn't strand `started` commands; auto-requeue stale ones.
- Cookie sync (`session_cookies`): encrypted at rest already — add decrypt-failure counter alerting + rotation prompt.
- Install/setup wizard page that walks user through: install extension → link token → verify capture → first apply.
- Extension manifest v3 review, packaging script, download button on settings page.

---

## How we proceed

You approve this plan → I execute **Phase 1** end-to-end and stop for you to review. Then you say "next phase" and I do Phase 2. This keeps each diff reviewable and avoids a 50-file blast.

Tell me to start Phase 1, or reorder phases if something is more urgent (e.g. "extension first").
