## Phase 3 — Backend Hardening

Tighten the server-side surface that Phases 2a–2c rely on. No new user-facing features; this is correctness, security, and performance.

### 1. Server-side Zod validation

Every `createServerFn` that takes input gets an `.inputValidator(schema.parse)` using the schemas already defined in `src/lib/validation/settings.ts` (reuse, don't duplicate). Targets:

- `src/lib/profile.functions.ts` — profile section updates
- `src/lib/queries/*.functions.ts` companions for automation, notifications, filters, gmail, extension tokens
- `src/lib/apply-worker.functions.ts` (or equivalent) — retry / requeue payloads
- Any server route under `src/routes/api/public/*` — validate JSON body + headers with Zod, return 400 on failure

Add a shared `src/lib/validation/server.ts` with `parseBody(schema, request)` and `parseQuery(schema, url)` helpers for server routes.

### 2. RLS + GRANT audit

Run linter + manual review across all `public.*` tables. For each table confirm:

- RLS enabled
- Policies scope to `auth.uid()` (or `has_role(...)` for admin-only)
- GRANTs present for `authenticated` + `service_role`; `anon` only where intentionally public
- No policy uses `USING (true)` for writes
- `user_roles` writes are blocked from `authenticated` (only service_role / triggers can grant roles)

Migration created per-table only where gaps are found. Document accepted public reads in security memory.

### 3. Database indexes

Add covering indexes for the hot query paths surfaced in Phase 2:

- `jobs (user_id, status, posted_at DESC)` — jobs list
- `jobs (user_id, matched, score DESC)` — matched feed
- `applications (user_id, created_at DESC)` — apps list
- `applications (user_id, status)` — status filter
- `application_events (application_id, created_at)` — timeline
- `usage_events (user_id, created_at DESC)` — already partly covered by `usage_mtd_by_provider`; verify
- `sources (user_id, last_run_at)` — staleness query
- Partial index on `applications (user_id) WHERE status IN ('failed','dlq')` — retry surface

### 4. Worker / queue hardening

`/api/public/hooks/apply-worker` and any cron-driven endpoints:

- HMAC signature verification using `WORKER_SHARED_SECRET` (add via `add_secret` if missing) with `timingSafeEqual`
- Idempotency key check (table `worker_invocations(idempotency_key PK, created_at)`, 24h dedupe)
- Per-user concurrency cap honoring `automation_settings.parallelism`
- Bounded retry: increment `retry_count`, move to `dlq` after N attempts, set `last_error`
- Structured logging via `console.log(JSON.stringify({...}))` for ClickHouse parsing

### 5. Auth + session correctness

- Verify `attachSupabaseAuth` is registered in `src/start.ts` `functionMiddleware`
- Confirm `_authenticated` layout's `beforeLoad` redirects unauthenticated users before any protected loader runs
- Audit serverFns called from public-route loaders (must be none)
- Ensure `block_extra_signups` trigger still active (single-user app invariant)

### 6. Error envelope + observability

- Standard error shape from server fns: `throw new Error(JSON.stringify({ code, message, hint? }))` consumed by `toastError` to surface `hint`
- Add `src/lib/errors.ts` with `AppError` class + `toAppError(unknown)` normalizer
- Wire server route handlers through a `withErrorBoundary` wrapper that returns `{ error: { code, message } }` with correct HTTP status

### Out of scope

- New UI
- Billing / Stripe
- Extension token rotation policy
- Multi-tenant features
- Migration of inherited edge functions (left as-is)

### Deliverable

Reply **"go"** to execute Phase 3, or call out sections to drop/reorder.
