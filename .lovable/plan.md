## Goal

Close the public-API auth holes flagged in the last security review without breaking cron, the browser app, or the extension.

## Issues being fixed

1. **Shared-secret = anon key.** `api-auth.server.ts` accepts the Supabase publishable key as the auth token. That key ships in the JS bundle, so anyone can call `apply-worker`, `check-heartbeat`, `daily-summary`.
2. **`run-tier` has no auth at all** and accepts `?user_id=<uuid>` — any visitor can trigger scrapes for any user's account.
3. **Browser callers** (`CommandPalette`, `setup.tsx`, `sources.tsx`, `jobs.ts`, `applications.ts`) send the anon key as `apikey`, never proving who the user is — so the server can't safely scope work to them.

Already-good endpoints (extension-token Bearer auth: `queue-apply`, `worker-status`, `upload-cookies`, `ingest-extension`, `error-report`; service-role: `worker.env.ts`) stay as-is.

## Plan

### 1. New secret `WORKER_CRON_SECRET`

Request via `add_secret`. Used by pg_cron and as the only way for external/internal jobs to bypass user auth on the hooks.

### 2. Rewrite `src/lib/api-auth.server.ts`

Replace the anon-key check with two helpers:

- `hasCronSecret(request)` — constant-time compare of `x-internal-secret` header against `process.env.WORKER_CRON_SECRET`.
- `requireUserOrCron(request)` — returns `{ userId: string | null, isCron: boolean }`:
  - If `x-internal-secret` matches → `{ userId: null, isCron: true }`.
  - Else if `Authorization: Bearer <jwt>` present → verify via `supabaseAdmin.auth.getUser(token)`, return `{ userId, isCron: false }`.
  - Else throw 401.

Keep `claimIdempotency` unchanged.

### 3. Endpoint changes

| Endpoint | New auth |
|---|---|
| `hooks/check-heartbeat` | `hasCronSecret` only |
| `hooks/daily-summary` | `hasCronSecret` only |
| `hooks/apply-worker` | `requireUserOrCron`. If user → restrict query to `applications.user_id = userId` (and ignore any cross-user `application_id`) |
| `sources/run-tier` | `requireUserOrCron`. If user → force `users = [{ user_id: userId }]`, **ignore** the `?user_id=` param |

### 4. Browser callers — send the user's JWT

In `src/components/CommandPalette.tsx`, `src/routes/_authenticated/setup.tsx`, `src/routes/_authenticated/sources.tsx`, `src/lib/queries/jobs.ts`, `src/lib/queries/applications.ts`:

Replace `headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY }` with:

```ts
const { data: { session } } = await supabase.auth.getSession();
fetch(url, { headers: { Authorization: `Bearer ${session?.access_token ?? ""}` } });
```

Drop the `&user_id=${user.id}` query param from `run-tier` calls — the server derives it from the JWT.

### 5. pg_cron migration

New migration that:
1. Stores `WORKER_CRON_SECRET` in `vault.secrets` (Supabase encrypted vault) via `vault.create_secret(...)`. (The value is interpolated into the migration; the secret then lives encrypted at rest.)
2. Re-schedules `jobpilot-heartbeat-check` and `jobpilot-daily-summary-tick` to read the value from `vault.decrypted_secrets` and send it as `x-internal-secret`, with NO `apikey` header.
3. Drops the existing schedules first.

### 6. Verify

- `bun run build` clean.
- Manual: hit `/api/public/sources/run-tier?tier=hot` with no auth → 401. With user JWT → runs only for that user. With cron header → runs for all enabled users.
- Browser: trigger Refresh Sources from CommandPalette while logged in → works.

## Out of scope

- Realtime per-user RLS (low risk: single-user signup block).
- Two Supabase linter warnings (extension in `public`, SECURITY DEFINER callable by authenticated) — intentional, no change.

## Files touched

- `src/lib/api-auth.server.ts` (rewrite)
- `src/routes/api/public/hooks/{apply-worker,check-heartbeat,daily-summary}.ts`
- `src/routes/api/public/sources/run-tier.ts`
- `src/components/CommandPalette.tsx`
- `src/routes/_authenticated/setup.tsx`
- `src/routes/_authenticated/sources.tsx`
- `src/lib/queries/{jobs,applications}.ts`
- New migration: re-schedule cron with vault secret
- New secret: `WORKER_CRON_SECRET`
