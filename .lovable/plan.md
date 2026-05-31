# Full System Audit — Gaps, Bugs, Missing Features

I walked the whole app (routes, server fns, DB schema, worker glue) and compared it to what an automated job-apply system actually needs. Below is the honest gap list, grouped by severity, then a build plan.

## Current state snapshot
- **0 jobs, 0 applications** in DB (cleanup wiped everything — fresh slate).
- **3 resumes** rows, only **1 default**, but **no UI to upload/preview/edit resumes** anywhere in the app.
- **No cover letter table, no cover letter UI, no AI generator** — yet `applications.cover_letter_id` is referenced. Dead column.
- **0 secrets set** (captcha, proxy, Gmail app password) → worker cannot auto-apply.
- **Worker heartbeat: last seen days ago** → automation is effectively dead.
- 20 sources enabled, 1 filter, automation toggle off.

---

## Critical gaps (block the core promise of the app)

1. **Resume management UI missing entirely.** Table exists, storage bucket exists, but there's no `/resumes` route. You can't upload, preview, mark default, delete, or attach a resume to an application.
2. **Cover letter feature non-existent.** No table, no generator, no template, no editor. `applications.cover_letter_id` points to nothing.
3. **No AI cover-letter / resume-tailoring generator.** Lovable AI is wired (`LOVABLE_API_KEY` set, `src/lib/apply/ai.server.ts` stub) but no user-facing generation flow.
4. **Apply pipeline broken end-to-end** — no Gmail creds, no captcha key, no proxy → every apply attempt would 401/timeout. No UI prompt to fix it.

## High-priority gaps

5. **No DLQ / retry UX.** `applications.retry_count`, `next_retry_at`, `dlq_reason` columns exist but nothing reads or writes them from the app, no "Retry" button.
6. **Application detail page is thin.** `application_events` are logged but not surfaced as a timeline with screenshots + error messages.
7. **Worker observability page is read-only stats** — no live log tail, no per-source health, no "kick worker" button.
8. **Idempotency not enforced.** `applications.idempotency_key` has no unique index → double-click can queue duplicates.
9. **Dedup is weak.** `jobs.dedupe_hash` is per-source; same role on RemoteOK + Indeed creates two rows.
10. **Notifications table + settings exist, but nothing sends emails.** No cron, no SMTP path wired.

## Medium gaps

11. **Setup page is informational, not actionable.** No green/red checklist driven by `getSystemReadiness()`.
12. **No "Re-score all jobs" button** after editing filters or Job Target.
13. **Source rows don't show what query was actually sent** to each scraper — hard to debug why a source returns junk.
14. **Profile completeness % not surfaced** anywhere — apply walker silently skips fields it can't fill.
15. **No screening-question library.** `profile.screening_answers jsonb` is empty and unused.

## Low / polish

16. Logs page has no filter by level/scope/run_id.
17. No "export my data" beyond the privacy route stub.
18. Admin console exists but doesn't show worker version, plan distribution, or error trends.
19. No onboarding wizard re-entry once dismissed.
20. No keyboard shortcuts surfaced (CommandPalette exists but is undiscoverable).

---

## Proposed build plan (ordered by impact)

### Phase A — Resume & Cover Letter (closes the biggest functional gap)
- **`/resumes` route**: list, upload PDF, paste LaTeX, set default, preview (signed URL from `resumes` bucket), delete.
- **Cover letters**:
  - New table `cover_letters` (id, user_id, name, kind: 'template'|'generated', body, job_id nullable, is_default, created_at) + GRANTs + RLS.
  - `/cover-letters` route: list, edit template, AI-generate per job (using `google/gemini-3-flash-preview` via Lovable AI).
  - Server fn `generateCoverLetter({ jobId, resumeId, tone })` returning markdown + saving row.
- **Application detail**: pick resume + cover letter before queueing apply; show both attached.

### Phase B — Setup checklist + readiness banner
- Expand `getSystemReadiness()` to cover: profile %, resume default, Gmail verified, captcha balance, proxy set, worker heartbeat, job target, 1+ source, 1+ filter, 1+ cover letter template.
- Rebuild `/setup` as red/amber/green list with deep-links to fix.
- Dashboard banner when any red item.

### Phase C — Apply pipeline reliability
- DB migration:
  - `CREATE UNIQUE INDEX applications_idempotency_uniq ON applications(idempotency_key) WHERE idempotency_key IS NOT NULL`
  - `CREATE UNIQUE INDEX applications_user_job_uniq ON applications(user_id, job_id) WHERE phase <> 'dead_letter'`
  - `cover_letters` table (above)
  - Tighten `jobs.dedupe_hash` to `md5(lower(company)||'|'||lower(title)||'|'||coalesce(location,''))` going forward.
- Server fns: `retryApplication(id)`, `discardApplication(id, reason)`.
- `/applications` gets a "Needs review" tab (phase = dead_letter).
- `/applications/$id` gets a timeline of `application_events` with screenshots + inline errors.

### Phase D — Job quality
- Already-rewritten `match_job_to_filters()` is good; add:
  - "Re-score all" button on `/filters` (calls existing `rescore_all_jobs_for_user`).
  - Per-source "Last query sent" line on `/sources` (read from `automation_runs.metadata->>'query'`).
  - Hard exclude list editable from Job Target UI.

### Phase E — Worker observability + notifications
- `/worker`: heartbeat dot + last 20 runs + live `logs` tail via Supabase realtime + per-source health card.
- New cron route `/api/public/hooks/notifications-tick` (5 min) that:
  - Sends "worker offline" if `last_seen < now() - 10m` and last alert > 1h ago.
  - Sends "apply failed" for new dead-letter rows.
  - Sends "high-score match" when score ≥ user threshold.
  - Sends daily summary at user's `daily_summary_time`.
- All via Gmail SMTP using stored `gmail_credentials`.

### Phase F — Polish
- Profile completeness % chip on `/profile` header.
- Logs filters (level, scope, run, date).
- Screening-question library on `/profile` (common Workday/Greenhouse questions with saved answers).
- CommandPalette hint (`Press ⌘K`) on dashboard.

---

## Out of scope (call out so we agree)
- Browser extension changes (route exists, stays as-is).
- Stripe/billing changes (table exists, no upgrade flow built).
- New scrapers — focus is making existing 20 sources reliable.
- Worker Python code changes (you rebuild that on your VPS) — I'll write the diff separately when needed.

---

## Suggested rollout order (one PR per phase so you can verify)
1. **A** — Resumes + Cover Letters UI + table + AI generation
2. **B** — Setup checklist + readiness banner
3. **C** — Apply DLQ + retry + idempotency indexes + timeline
4. **D** — Re-score button + per-source query line + hard-exclude UI
5. **E** — Worker live page + notifications cron
6. **F** — Polish

If you only want me to do part of this now, the highest-leverage cut is **A + B + C** — that gives you resumes, cover letters, a working "is my system green?" page, and a recoverable apply pipeline. The rest can follow.

Reply with which phases to ship (or "all of it"), and I'll start.
