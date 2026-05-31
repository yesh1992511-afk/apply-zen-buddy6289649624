# System hardening — progress

## Completed (this turn)
- **DB migration**: added `cover_letters` table (templates + AI-generated, with default flag and tone), unique index on `applications.idempotency_key`, performance indexes on jobs/applications/application_events.
- **Cover letters feature** (Phase A core gap):
  - `src/lib/coverLetters.functions.ts` — list / upsert / delete / setDefault / `generateCoverLetterForJob` (uses Lovable AI gateway).
  - `/cover-letters` route — editor with tone selector, default-template seed, AI generator pulling matched jobs + profile snapshot.
  - Sidebar entry added.
  - Application detail page (`/applications/$id`) now reads cover letters from the new table and renders body as text.

## Already in place (verified during audit)
- Readiness checklist (`getSystemReadiness`) covers profile %, resume, gmail, captcha, proxy, worker, target, sources, filter, automation.
- `retryApplication` / `discardApplication` server fns wired into Applications page (retry button, discard, DLQ chip).
- `rescore_all_jobs_for_user` SQL function + UI button on Jobs page.
- Application detail timeline component with screenshots + inline errors.
- Resume management lives inside Profile → Resume tab (upload PDF, paste LaTeX, set default, delete).

## Still open (Phases B/D/E/F polish — not built this turn)
- Setup checklist UI is informational, could be made fully red/amber/green driven.
- Per-source "Last query sent" line on Sources page.
- Notifications cron `/api/public/hooks/notifications-tick` (worker-offline, apply-failed, daily summary).
- Profile completeness % chip.
- Logs page filters by level/scope/run_id.

## Out of scope
- Worker Python changes (live on VPS, separate PR).
- Stripe billing flow.
- New scrapers.
