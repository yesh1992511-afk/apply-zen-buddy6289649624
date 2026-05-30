# Clear scraped jobs

You want the irrelevant (pre-cybersecurity) jobs gone, and a way to do it again later without me.

## What I'll do

1. **One-time purge (now)** — delete every row in `jobs` for your owner user. Also clean related rows that point at those jobs so nothing dangles:
   - `applications` rows for those jobs (none should be in-flight; if any are `queued/applying`, I'll skip those and report)
   - `application_events`, `logs`, `notification_log` entries tied to those job ids

2. **Add a "Clear all jobs" action** on the Jobs page (top-right, destructive button with confirm dialog). It calls a server fn that does the same scoped delete as above for `auth.uid()`. RLS already scopes to owner, so no extra policy work.

3. **Optional toggle in the confirm dialog**: "Also remove queued applications". Default off — only deletes jobs that have no active application.

## Out of scope

- No re-scoring of future jobs (already handled by the cybersecurity filter from the previous step).
- No soft-delete / trash — straight delete, as you asked.

## Files

- `src/routes/_authenticated/jobs.tsx` — add button + confirm dialog
- `src/lib/jobs.functions.ts` (new or existing) — `clearAllJobs({ includeApplications })` server fn
- Data purge runs via the insert/delete tool, scoped to your `user_id`

Confirm and I'll execute.