# Polish & verification pass — extension ⇄ backend ⇄ VPS sync

The deep overhaul from the previous turn already shipped: realtime invalidation, offline outbox, apply button, encrypted cookie pipe, realtime worker wake. This pass closes the remaining sharp edges so the loop actually feels live end-to-end, and adds the missing observability so you can *see* it sync.

## What's already in place (verified)

- `attachSupabaseAuth` wired in `src/start.ts` ✓
- Realtime publication includes `sources`, `session_cookies` + `REPLICA IDENTITY FULL` ✓
- Extension v1.1.0: outbox, retries, dedupe, popup status, apply button, cookie pipe ✓
- Worker realtime subscription on `sources` with wake_loop ✓
- `/api/public/sources/{ingest-extension, queue-apply, upload-cookies, worker-status}` all live ✓

## Gaps this pass fixes

### 1. Extension popup never actually calls `status`
`popup.js` shows a `workerDot` and `qappsEl` but the file is truncated and only renders once — there's no `refreshStatus()` that messages background. Result: dot stays grey, "queued apps" stays blank.
**Fix:** finish `popup.js` so it sends `{type:"status"}` on open + every 10s, and renders `online`, `last_seen`, `pending`, `queued_apps`.

### 2. Worker realtime listener uses sync supabase-py inside asyncio
`supabase.create_client(...).channel(...).subscribe()` is synchronous and blocks the event loop on connect; on Python supabase v2 it also needs `realtime.connect()` first or it silently no-ops. Symptom: source toggle does nothing until the 2-minute tick.
**Fix:** move the realtime client to `AsyncClient` (`acreate_client`) and `await channel.subscribe()`, with a reconnect loop on disconnect.

### 3. `run_due_sources(force=True)` doesn't exist
`wake_loop` passes `force=True` but `registry.run_due_sources()` only takes no args. The wake path raises and is swallowed.
**Fix:** add `force: bool = False` to `run_due_sources` that bypasses the cadence check when true.

### 4. Dashboard has no "sync health" surface
Live dot exists but the user can't tell at a glance: extension paired? last capture? worker last_seen? queue depth? cookies fresh?
**Fix:** add a `<SyncHealthCard>` on the dashboard with 4 chips: Extension (last capture), Worker (heartbeat age), Apply queue (count), Cookies (hosts × freshness). All driven by realtime, no polling.

### 5. Sources toggle has no optimistic feedback
Toggle flips, but UI waits for realtime echo before showing the new state — feels laggy.
**Fix:** optimistic update via `queryClient.setQueryData` on the mutation, rollback on error.

### 6. Apply button on job pages has no result feedback
`content-apply.js` POSTs and… nothing. User doesn't know if it worked.
**Fix:** show a 3-second toast pill (success ✓ / already queued / error) anchored to the button.

### 7. Cookie freshness invisible to worker
`sessions.py` loads cookies but never logs which hosts were injected or refused. When auto-apply fails on a login wall, you can't tell if cookies were used.
**Fix:** structured `db_log` on cookie inject (host, count, age_days) and on decrypt failure (bad passphrase / expired).

### 8. Extension token rotation has no UI
If the token leaks, the only recovery is SQL. Add "Rotate token" button on `/extension` settings page (already exists for pairing) that calls a tiny server fn.

## Out of scope

- New scrapers / apply adapters
- Billing / pricing
- Visual redesign
- Adding more job sites to the extension

## Files

**Edit (8):**
- `extension/popup.js` — finish status polling + render
- `extension/content-apply.js` — toast feedback
- `worker/app/main.py` — async realtime client + reconnect
- `worker/app/sources/registry.py` — add `force` arg
- `worker/app/sessions.py` — structured logs
- `worker/app/apply/browser.py` — log cookie usage outcome
- `src/routes/_authenticated/dashboard.tsx` — mount `<SyncHealthCard>`
- `src/routes/_authenticated/sources.tsx` — optimistic toggle

**Create (3):**
- `src/components/SyncHealthCard.tsx`
- `src/lib/extension.functions.ts` — `rotateExtensionToken` server fn
- `src/routes/_authenticated/extension.tsx` *(only if missing — otherwise edit)*

No DB migrations. No new endpoints. No new env vars.

## Acceptance checks

1. Open extension popup → worker dot turns green within 2s, "queued apps" reflects DB.
2. Toggle a source in dashboard → worker log shows "sources changed (realtime) — forcing tick" within ~2s, source row updates without manual refresh.
3. Click "Apply via JobPilot" on a LinkedIn job → toast shows ✓, dashboard Applications list gets new row live.
4. Disconnect VPS for 90s → dashboard SyncHealthCard worker chip goes amber → red.
5. Upload cookies via extension options → worker log shows `cookies_injected host=linkedin.com count=N age_days=0` on next apply.
