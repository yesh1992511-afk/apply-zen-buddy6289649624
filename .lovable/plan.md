## Audit summary

I traced the full scrape → match → queue → apply pipeline against the live DB and code. Wiring is intact:

- **All 32 triggers attached** — `jobs_auto_queue_matched_job` (queues applications when `matched` flips true), `enforce_apply_quota_trg` (caps daily applies), `block_extra_signups_trigger` (single-user lock), `on_auth_user_created` (seeds profile/settings), `validate_*` and `set_updated_at` triggers all present.
- **All crons scheduled** — `apply-worker-every-minute`, `sources-hot-tier` */15, `scrape-usajobs` hourly, `scrape-apify` /4h, 8 `sources-warm-shard-*` jobs, heartbeat /5, daily-summary /15, log purge & worker-invocations prune nightly.
- **`runOneShotBatch` → `/api/public/sources/run-batch`** is fully wired with `WORKER_CRON_SECRET`, daily-cap clamp, `RunBatchButton` mounted on `/jobs` and `/applications`.
- **RLS** — every user-data table scoped to `auth.uid() = user_id`. `service_role`-only on `jd_analysis_cache`. No leaks.

## Real issues to fix

### 1. Auto-apply UX is misleading (HIGH — the one you actually care about)

`src/routes/api/public/hooks/apply-worker.ts` lines 211–286 always set `status = 'needs_review'` even when a supported portal (greenhouse / lever / ashby / workable / smartrecruiters / recruitee) is detected. The worker tailors the resume + cover letter and prepares form fills, then stops at "ready to submit" because actual browser submission requires a headless browser, which the Cloudflare Worker runtime cannot host. The user-facing copy still says "Auto apply", which is misleading.

Fix (frontend + copy + status semantics — no backend behavior change because the runtime constraint is real):
- Rename the user-visible label everywhere from "Auto apply" → **"Auto prepare & queue for 1-click submit"** in `RunBatchButton`, `automation.tsx`, `jobs.tsx`, `applications.tsx`, kanban column header.
- Add a clear `needs_review` kanban column tooltip: "Resume + cover letter generated, form fills mapped. Click 'Open & 1-click apply' to submit on the portal."
- In `AllApplicationsKanban` / `applications.$id.tsx`, add a prominent **"Open job → 1-click submit"** button on `needs_review` cards that opens `job.url` in a new tab and copies the cover letter to clipboard.
- Update the success toast in `RunBatchButton` from "Apply worker will submit them" → "Apply worker will prepare them — review and 1-click submit from Applications."

(No headless-browser feature is added — that would require a separate VPS/Browserless service the user hasn't provisioned. We make the existing semi-automated flow honest and 1-click fast.)

### 2. Missing Content-Security-Policy header (MEDIUM — security scanner finding)

`applications.$id.tsx` renders scraped job HTML via `dangerouslySetInnerHTML` with DOMPurify. Add a CSP response header as defense-in-depth.

Fix: extend `src/start.ts` request middleware (`errorMiddleware` lives there) with a small `securityHeadersMiddleware` that sets:
```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.gpteng.co; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://*.supabase.co wss://*.supabase.co; object-src 'none'; base-uri 'self'
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
```
(`'unsafe-inline'` for scripts kept because Lovable's preview shim needs it; the policy still blocks injected `<script src=…>` and `eval`, which is the real XSS surface.)

### 3. pg extensions in `public` schema (LOW — Supabase linter warn)

`pg_net` and `pg_cron` are installed in `public`. Move them to a dedicated `extensions` schema via migration:
```sql
CREATE SCHEMA IF NOT EXISTS extensions;
ALTER EXTENSION pg_net SET SCHEMA extensions;
ALTER EXTENSION pg_cron SET SCHEMA extensions;
GRANT USAGE ON SCHEMA extensions TO postgres, service_role;
```
Then update `bootstrap_apply_worker_cron` `SET search_path` to include `extensions`, and verify cron jobs still tick (they reference `cron.schedule` / `net.http_post` by full qualification already, so no breakage expected).

## Out of scope (intentionally)

- Building a true headless-browser submitter (needs separate infra; user hasn't provisioned).
- Re-architecting source adapters (they work, audited in prior turn).
- Adding new tables, RLS changes, or new server fns (system is feature-complete).

## Files changed

- `src/components/RunBatchButton.tsx` (copy)
- `src/components/AllApplicationsKanban.tsx` (column label + tooltip + 1-click button)
- `src/routes/_authenticated/applications.$id.tsx` (1-click submit panel for `needs_review`)
- `src/routes/_authenticated/automation.tsx` (label clarity)
- `src/start.ts` (add `securityHeadersMiddleware`)
- New migration: move extensions to `extensions` schema
