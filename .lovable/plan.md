## Outstanding issues to fix

### 1. Cron calling `/api/public/hooks/apply-worker` fails with UNAUTHORIZED every minute

**Root cause:** The route's `requireUserOrCron` accepts only:
- `x-internal-secret: <WORKER_CRON_SECRET>`, or
- `Authorization: Bearer <user JWT>`

The current `pg_cron` job sends the Supabase anon key (likely as `apikey` / `Authorization`), which is neither. Result: 401 every minute, application queue never drains.

**Fix:** Reschedule the pg_cron job to send the correct `x-internal-secret` header, sourced from Vault (so the secret is not stored in the cron command in plaintext).

```sql
-- Unschedule old (broken) job(s)
SELECT cron.unschedule(jobid)
FROM cron.job
WHERE command ILIKE '%apply-worker%';

-- Store the worker secret in Vault (one-time)
SELECT vault.create_secret(
  '<WORKER_CRON_SECRET value>',
  'worker_cron_secret',
  'Shared secret for /api/public/hooks/* cron callers'
);

-- Reschedule every minute with the internal secret header
SELECT cron.schedule(
  'apply-worker-every-minute',
  '* * * * *',
  $$
  SELECT net.http_post(
    url     := 'https://project--ba5780a8-641e-4ee8-9c24-6e1c185cef2f.lovable.app/api/public/hooks/apply-worker',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'worker_cron_secret')
    ),
    body    := '{}'::jsonb
  );
  $$
);
```

I'll run this via the Supabase insert tool (not a migration — it contains a secret value and is environment-specific). After running, I'll verify by tailing server logs for the next minute and confirming `evt: apply-worker` with HTTP 200 instead of 401.

Also audit any other `/api/public/hooks/*` cron jobs (sources poller, etc.) and apply the same header fix if they share the same auth helper.

### 2. `_authenticated` layout skips its auth check during SSR

**File:** `src/routes/_authenticated.tsx`

```ts
beforeLoad: async () => {
  if (typeof window === "undefined") return; // <-- footgun
  const { data } = await supabase.auth.getUser();
  ...
}
```

Today no protected child has a loader, so nothing is broken. But the moment someone adds `loader: () => getUserPosts()` under `_authenticated/`, SSR will run the loader against `requireSupabaseAuth` with no session and fail the prerender (the documented `build:dev` Unauthorized trap).

**Fix:** Replace the window short-circuit with a serverFn-backed check that works in both SSR and the browser. Add a tiny server function `getAuthUser` (uses `requireSupabaseAuth` middleware) and call it via `useServerFn`-style call inside `beforeLoad`. When it throws Unauthorized, redirect to `/login` with the redirect-back search param. Keep the `onAuthStateChange` listener in the component for client-side session-loss handling, but drop the duplicate `supabase.auth.getUser()` poll in the `useEffect`.

Effect: any future loader under `_authenticated/*` is safe by construction; behavior in the browser is unchanged for the user.

### 3. Verification

- After the cron fix: `stack_modern--server-function-logs` filtered on `apply-worker` should show 200s, no more `UNAUTHORIZED`.
- After the layout fix: load `/dashboard` in preview, confirm no flash, no double redirect, no console errors.
- Re-run security scan + Supabase linter; confirm the previously accepted items (`pg_cron`/`pg_net` in `public`, RLS-on-no-policy on `jd_analysis_cache`) are the only remaining items.

### Out of scope
- No business-logic changes.
- No DB schema changes.
- No UI changes.
