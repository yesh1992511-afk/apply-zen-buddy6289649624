## Phase 2c — Settings autosave, validation & mobile polish

Bring the remaining settings surfaces up to the Phase 2a/2b bar: per-section autosave, Zod validation with inline errors, unified skeletons/empty states, and a mobile pass across the app shell.

### 1. Shared form primitives

- `src/lib/validation/` — Zod schemas per settings domain:
  - `automation.ts` (aggressiveness 1–5, parallelism 1–10, max_applies_per_day 1–500, daily_start < daily_end when not 24/7, timezone string).
  - `notifications.ts` (recipient_email, high_score_threshold 0–100, daily_summary_time).
  - `filters.ts` (name required, min_score 0–100, posted_within_hours ≥ 1, salary_min ≥ 0).
  - `gmail.ts` (email, app_password length, host/port shape).
  - `profile-sections.ts` (extend Phase 2a coverage to phone, URLs, salary numerics).
- `src/components/FieldError.tsx` — inline error chip, used under inputs.
- `src/components/SectionCard.tsx` — wraps each settings block with title, description, `<SavedIndicator>`.
- Reuse `useDebouncedCallback` + `SavedIndicator` from Phase 2a. New helper `useAutosaveSection<T>(schema, mutationFn)` returning `{ values, setField, status, errors, flush }`.

### 2. Query/mutation layer

Add under `src/lib/queries/`:
- `automation.ts` — `automationQueryOptions`, `useUpdateAutomation` (patch).
- `notifications.ts` — `notificationsQueryOptions`, `useUpdateNotifications`.
- `filters.ts` — extend existing or add `useUpsertFilter`, `useDeleteFilter`, `useSetActiveFilter`.
- `gmail.ts` — `gmailCredsQueryOptions`, `useUpsertGmailCreds`, `useVerifyGmailCreds` (calls existing verify path).
- `extension.ts` — `extensionTokensQueryOptions`, `useCreateToken`, `useRevokeToken`.

All mutations invalidate their keys + emit `toastSaved`/`toastError`.

### 3. Route refactors (autosave + validation)

For each, replace manual `useState` + Save button with section-scoped autosave:

- `/automation` — split into "Schedule", "Throughput", "AI models", "Exclusions" cards; each section autosaves on blur with 800ms debounce. Inline errors via Zod.
- `/notifications` — sections: "Recipient", "Triggers", "Daily summary". Time picker validated.
- `/filters` — autosave per filter row; "New filter" mutation; "Set active" radio; delete confirm via AlertDialog. Keyword chips with add/remove.
- `/setup` (Gmail credentials) — autosave creds; explicit "Verify connection" button (mutation) showing last verified timestamp + `last_error`.
- `/extension` — list tokens with copy-to-clipboard, revoke, last-seen badge; create token via mutation.
- `/privacy` — request/cancel account deletion via mutation; show `purge_after` countdown.
- `/profile` — extend Phase 2a engine to remaining fields (location, URLs, salary range, work auth toggles) with the same per-field autosave.

### 4. Cross-cutting polish

- `src/components/Skeletons.tsx` — `<CardSkeleton>`, `<RowSkeleton>`, `<FormSkeleton>` for unified loading.
- `src/components/EmptyState.tsx` — icon + title + description + optional CTA; reuse on jobs/applications/sources/logs empty results.
- Mobile pass: audit `_authenticated` shell sidebar → ensure drawer on `<md`; tables on jobs/applications switch to card list under `md`; settings cards stack with full-width inputs.
- Replace remaining ad-hoc `toast(...)` calls with `toastSaved`/`toastError`/`toastQueued`.
- Wire `useRealtimeInvalidate` (Phase 2b) to settings tables (`automation_settings`, `notification_settings`, `filters`, `gmail_credentials`, `extension_tokens`) so multi-tab edits stay in sync.

### Out of scope (Phase 3)

- Server-side Zod on serverFns, RLS audit, DB indexes, worker queue hardening, extension token rotation policy, billing/Stripe surfaces.

Reply **go** to execute Phase 2c end-to-end, or **phase 3** to skip to backend hardening.
