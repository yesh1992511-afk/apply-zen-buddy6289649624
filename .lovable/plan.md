
## Platform health check — findings

I ran the security scanner, the database linter, and pulled the last hour of server-function logs. Here's what came back and what I propose to fix.

### 1. CRITICAL — Auth bypass in server-function middleware
`src/integrations/supabase/auth-middleware.ts` validates bearer tokens with `supabase.auth.getClaims(token)` using the **publishable (anon) key**. That call only base64-decodes the JWT payload — it does **not** verify the signature. An attacker can forge a JWT with any `sub` claim and the middleware will accept it, granting full access to every `createServerFn` (billing, privacy, applications, admin, worker dispatch, automation settings, …). Because this is a single-user app, the entire data store is exposed.

**Fix:** switch the middleware to validate via `supabaseAdmin.auth.getUser(token)` — a server-side call that verifies the signature against GoTrue. This is the same pattern already used correctly in `src/lib/api-auth.server.ts`.

> ⚠️ `auth-middleware.ts` is in the "preconfigured files do not edit" list. I'll need your OK to patch it directly, since the scanner flagged the auto-generated version as vulnerable. Alternative: I introduce a new `requireSupabaseAuthVerified` wrapper and migrate every server fn to it.

### 2. WARN — `jd_analysis_cache` readable by any authenticated user
The table has a `SELECT ... USING (true)` policy. Cached job-description analyses (proprietary content + AI output) are visible to any signed-in user. In a single-user app this is low-impact today, but it's a latent leak.

**Fix:** drop the public SELECT policy; restrict reads to `service_role` only (server fns use `supabaseAdmin`).

### 3. WARN — SECURITY DEFINER function executable by signed-in users
One of the `SECURITY DEFINER` functions has `EXECUTE` granted to `authenticated`. Likely `rescore_all_jobs_for_user` (it has an internal `auth.uid()` guard, so behavior is safe, but the linter still flags it).

**Fix:** `REVOKE EXECUTE … FROM authenticated, anon, public; GRANT EXECUTE … TO service_role` and call it only from server-fn code via `supabaseAdmin`.

### 4. WARN — Extension installed in `public` schema
Pre-existing, low risk. Moving extensions between schemas can break dependent objects. **Recommendation: leave as-is** and acknowledge in security memory unless you want me to attempt the move.

### 5. Cron 401s in worker logs — already fixed
Logs from 20:35–20:41 UTC show `apply-worker` / `check-heartbeat` returning 401 (`Invalid apikey`). The SQL editor screenshot at 20:42 shows the next runs `succeeded`. These are stale errors from before the Vault sync — no action needed; will fall off the 1-hour window naturally.

---

## Plan

1. **Patch `auth-middleware.ts`** to call `supabaseAdmin.auth.getUser(token)` (signature-verified). Keep the same exported `requireSupabaseAuth` API so no call sites change.
2. **Migration**: drop the open `SELECT` policy on `jd_analysis_cache`; add a service-role-only policy.
3. **Migration**: `REVOKE EXECUTE` on `public.rescore_all_jobs_for_user(uuid)` from `authenticated, anon, public`; keep `service_role`. If any UI calls it directly via `supabase.rpc(...)`, wrap it in a `createServerFn` that uses `supabaseAdmin`.
4. **Verify**: re-run security scan + linter; mark findings 2 & 3 fixed; ignore #4 (extension) with explanation in security memory.
5. **Skip**: cron 401 noise — already resolved.

Approve and I'll execute.
