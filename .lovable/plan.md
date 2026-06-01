I checked the live data and this is not “no jobs exist.” The system scraped 389 jobs recently, including security jobs, but 0 are visible because the matching logic is too strict/buggy and the Jobs page only shows `matched = true`.

Root causes found:
- `automation_settings.enabled` is currently false, so the “Match & prepare” batch refuses to run unless Autopilot is enabled.
- Recent Apify tier returned 0 items for all Apify sources, while ATS/board tiers did scrape jobs.
- Cybersecurity jobs are being discarded. Example: “Product Security Engineer” and “Staff Security Engineer, Application Security” exist in the database but are marked discarded.
- The database matcher treats exclude keyword `security guard` as matching any text containing both “security” and “guard” too loosely in practice, and its array phrase handling appears to be failing for multi-word phrases like “product security engineer” / “application security.”
- The UI has no “show scraped/discarded jobs” view, so when filters are too strict it looks like scraping found nothing.

Plan:

1. Fix the matcher so real cyber jobs match
- Update the database scoring function to tokenize and phrase-match correctly.
- Count exact phrases like `application security`, `cloud security`, `security engineer`, `threat intelligence` as strong matches.
- Keep exclusions precise: `security guard` should only exclude actual guard/physical-security roles, not product/application/security-engineering roles.
- Preserve the existing country/language gates and user-owned RLS model.
- Re-score existing scraped jobs after the matcher update so already-scraped security jobs appear without waiting for a new scrape.

2. Make scraped-but-discarded jobs visible
- Add a Jobs page toggle/tab for `Matched` vs `All scraped`.
- In `All scraped`, show discarded jobs with their discard reason/score breakdown so you can see what the scraper found and why it was hidden.
- Keep `Matched` as the default apply queue view so low-quality jobs do not auto-queue.

3. Fix batch behavior when Autopilot is paused
- Let “Match & prepare” scrape and match even if Autopilot is paused.
- If Autopilot is off, do not auto-queue applications; show a clear result like “matched X jobs; enable Autopilot or queue manually.”
- If Autopilot is on, keep the existing prepare/queue flow.

4. Fix Apify source inputs and diagnostics
- Align the server-side Apify LinkedIn actor payload with the working Python worker payload (`title`, `location`, `rows`, `publishedAt`) instead of the current mismatched `queries/locations` shape.
- Apply similar known-good payload mapping for Glassdoor/Google Jobs where the server adapter currently differs from the worker adapter.
- Store clear per-source warnings when Apify returns 0 so the Sources/Worker UI shows whether it was “actor returned no items,” “actor auth/subscription issue,” or “request timed out.”

5. Add an immediate verification path
- After implementation, run a user-scoped source tier/batch check.
- Verify that current security jobs re-score to matched and appear on Jobs.
- Verify Apify LinkedIn either returns jobs or shows a clear source error instead of silently looking empty.

Files/areas to change:
- Database function: `match_job_to_filters` via migration.
- Frontend Jobs query/UI: `src/lib/queries/jobs.ts`, `src/routes/_authenticated/jobs.tsx`.
- Batch server function: `src/lib/applications.functions.ts`, `src/routes/api/public/sources/run-batch.ts`.
- Apify adapters: `src/lib/sources/adapters.server.ts`.

Security notes:
- No public data exposure; all job queries remain user-scoped by existing RLS.
- No secrets added to code; Apify token continues to be read from backend secrets only.
- The new “All scraped” view still only shows the signed-in user’s own scraped jobs.