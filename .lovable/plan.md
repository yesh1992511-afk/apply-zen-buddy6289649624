## Phase 4 — Verify & Polish

Phase 3 shipped DB indexes, idempotency, error envelope, and `apikey` auth on cron hooks. Before moving on, lock it down with verification and small follow-ups.

### 1. Verify Phase 3 in the live backend
- Run `supabase--linter` and fix anything new it surfaces.
- Spot-check the new indexes exist (`pg_indexes`) and that `worker_invocations` is writable by `service_role` only.
- Hit `/api/public/hooks/{apply-worker,check-heartbeat,daily-summary}` without `apikey` → expect 401; with `apikey` → expect 200.
- Re-fire `apply-worker` with the same idempotency key → expect `skipped`.

### 2. Server-side Zod on remaining serverFns
Phase 3 audit noted "existing handlers already use Zod" but skipped a final pass. Confirm every `createServerFn` in:
- `src/lib/profile.functions.ts`
- `src/lib/queries/*.ts` (automation, notifications, filters, gmail, extension, applications, jobs)
- `src/lib/apply-worker.functions.ts`

has `.inputValidator(schema.parse)`. Add where missing using schemas from `src/lib/validation/settings.ts`. No new schemas unless a gap exists.

### 3. Wire `withErrorBoundary` into the 3 public hooks
`src/lib/errors.ts` exists but the hooks still hand-roll JSON responses. Wrap each handler so failures return the standard `{ error: { code, message, hint? } }` envelope and the client's `toastError` shows the hint automatically.

### 4. Pruning + observability
- Schedule `prune_worker_invocations()` via pg_cron (daily) so the dedupe table doesn't grow unbounded.
- Add structured `console.log(JSON.stringify({evt, userId, ...}))` at start/end of each hook for ClickHouse.

### 5. Quick UI follow-ups surfaced by Phase 2
- Surface `last_error` from failed applications in `ApplicationTimeline`.
- Show `skipped`/`requeued` counts in the toast returned by manual "Run worker" on `/jobs` and `/applications`.

### Out of scope
- New features, billing, extension rotation, edge function migration.

### Deliverable
Reply **"go"** to execute, or call out sections to drop.
