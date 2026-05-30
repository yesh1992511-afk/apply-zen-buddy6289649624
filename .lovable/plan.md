# End-to-end Sync Overhaul — Extension ↔ Cloud ↔ VPS Worker

Close every gap you flagged and give the whole system a single nervous system: Supabase Realtime. Plus extension polish (offline queue, popup status, apply button) and the security-sensitive cookie pipe for VPS auto-apply.

## Verified current state
- Extension is read-only capture for 6 sites; `background.js` POSTs to `/api/public/sources/ingest-extension`. No offline queue, no retry, popup is static.
- Worker writes to `worker_heartbeat` every loop (`heartbeat.py`) and polls `worker_commands` (`commands.py`); reads `sources` on a cadence but only via `run_due_sources()` tick — toggling a source doesn't wake the worker.
- Realtime publication already covers `logs, worker_commands, worker_heartbeat, applications, jobs`. **`sources` is NOT in the publication** → enable/disable doesn't propagate.
- Dashboard pages use plain `useQuery` with no realtime invalidation.
- No `session_cookies` table; worker today must log in fresh on every apply.

## Plan

### 1. Realtime nervous system (frontend)
- Add `src/hooks/useRealtimeInvalidate.ts` — one hook that subscribes to a table + filter and invalidates a TanStack Query key on every change. Cleans up on unmount.
- Wire it into: `dashboard.tsx` (jobs, applications, worker_heartbeat), `sources.tsx` (sources), `applications/index.tsx` + `applications.$id.tsx` (applications, logs), `worker.tsx` (worker_commands, worker_heartbeat).
- Add a tiny `<LiveDot>` component in the top bar that turns green when `worker_heartbeat.last_seen` is < 90 s old (driven by the realtime hook). Used in dashboard header + popup later.

### 2. Migration — close realtime + cookie gaps
Single migration:
- `ALTER PUBLICATION supabase_realtime ADD TABLE public.sources;`
- `ALTER TABLE public.sources REPLICA IDENTITY FULL;` (and same for the 5 already-published tables that lack it, so realtime payloads include old rows).
- New table `public.session_cookies` for the cookie pipe:
  - columns: `user_id uuid`, `host text` (`linkedin.com`, `indeed.com`, …), `cookies jsonb` (encrypted blob client-side before insert), `updated_at`, `expires_at`.
  - Unique `(user_id, host)`. RLS owner-only. GRANTs for `authenticated` + `service_role`.
- New table `public.extension_outbox_dedupe` is NOT needed — extension keeps the queue in `chrome.storage.local`.
- Index `(user_id, last_seen)` on `worker_heartbeat`.

### 3. Worker reacts to source toggles instantly
- `worker/app/main.py`: in addition to the cadence tick, open a Supabase realtime subscription on `sources` filtered by `user_id`. On any change, push a `refresh_sources` event into the loop's queue so the next iteration re-reads `sources` and runs anything newly enabled / due.
- New `worker/app/sessions.py`: helper to load decrypted cookies from `session_cookies` and inject into Playwright context per host. Updated in `worker/app/apply/browser.py` so every adapter that supports cookie auth uses them.

### 4. Extension — capture, queue, status, apply button
- **Offline queue + retry** (`background.js`): keep captures in `chrome.storage.local.outbox`. Flush on `online` event and on a 30 s alarm. Exponential backoff (5 s → 5 min). Per-URL dedupe so re-visits don't double-post.
- **Popup** (`popup.html` + `popup.js`):
  - Worker dot (green/red) from `worker_heartbeat` via fetch to a new tiny endpoint `/api/public/sources/worker-status`.
  - "Captures today" + "Pending in queue".
  - Big "Sync now" button → flushes queue.
- **Apply button injection** — new `content-apply.js` declared for all 6 hosts. Adds a floating "Apply via JobPilot" button on each job page. Click → POSTs to new server route `/api/public/sources/queue-apply` which inserts an `applications` row with `status='queued'`; worker picks it up.
- **Cookie pipe** — new content script `content-cookies.js` (host-permissioned, opt-in toggle in `options.html`). On a 12 h alarm, reads `document.cookie` (only what the page exposes), encrypts client-side with a user-supplied passphrase (stored in `chrome.storage.local` only), and POSTs to new server route `/api/public/sources/upload-cookies`. Passphrase never leaves the browser — server stores ciphertext only. Worker uses the same passphrase (set once in `worker/.env`) to decrypt. **The passphrase you'll need to set in two places: the extension Options page and the VPS `.env`.**

### 5. New server routes
All under `src/routes/api/public/sources/`:
- `worker-status.ts` — GET; returns `{ online: bool, last_seen, version }` for caller's user. Token via existing `extension_tokens.token`.
- `queue-apply.ts` — POST; body `{ token, job }`; upserts `jobs` row (status=`matched`), inserts `applications` row (`queued`).
- `upload-cookies.ts` — POST; body `{ token, host, ciphertext, expires_at }`; upserts into `session_cookies`. Validates host against whitelist.
- All four follow the existing `ingest-extension.ts` token-auth pattern (HMAC token from `extension_tokens`), include CORS, validate input with Zod, and update `extension_tokens.last_seen_at` + counters.

### 6. Dashboard polish
- New `worker.tsx` route — surfaces heartbeat, last 50 `worker_commands`, "send command" buttons (`refresh_sources`, `restart`, `dry_run`).
- Dashboard top bar gets the `<LiveDot>` + "Jobs today / Applies today" counters that tick live via realtime.
- Sources page rows show a small spinner when `last_run_status` flips to `running`, green check on `success`.

### 7. Out of scope
- No new scrapers / apply adapters (coverage already at ~93%).
- No payment / billing changes.
- No design system overhaul.

## File map

```
NEW
  src/hooks/useRealtimeInvalidate.ts
  src/components/LiveDot.tsx
  src/routes/_authenticated/worker.tsx
  src/routes/api/public/sources/worker-status.ts
  src/routes/api/public/sources/queue-apply.ts
  src/routes/api/public/sources/upload-cookies.ts
  supabase/migrations/<ts>_realtime_and_cookies.sql
  extension/content-apply.js
  extension/content-cookies.js
  extension/crypto.js              (WebCrypto AES-GCM helper)
  worker/app/sessions.py

EDITED
  extension/manifest.json          (+ new content scripts, alarms perm)
  extension/background.js          (outbox, retry, alarms, dedupe)
  extension/popup.html / popup.js  (status, queue depth, sync btn)
  extension/options.html / options.js (cookie-pipe opt-in + passphrase)
  src/routes/__root.tsx            (root realtime listener for worker dot)
  src/routes/_authenticated/dashboard.tsx
  src/routes/_authenticated/sources.tsx
  src/routes/_authenticated/applications.tsx, applications.$id.tsx
  worker/app/main.py               (realtime sources subscription)
  worker/app/apply/browser.py      (inject cookies from sessions.py)
```

## Acceptance checks (I'll run after build)
1. Toggle a source in UI → worker log shows `refresh_sources` within ~2 s.
2. Capture a LinkedIn job with extension offline → reconnect → row appears in `jobs` table within 30 s and surfaces in dashboard without reload.
3. Worker dot turns red within 2 min of stopping `worker` on VPS.
4. Upload cookies via extension → `session_cookies` row exists, ciphertext non-empty → restart worker → applying a LinkedIn job skips login.
5. Apply button click on Indeed → `applications` row appears in queue live.

Ready to build on approval.
