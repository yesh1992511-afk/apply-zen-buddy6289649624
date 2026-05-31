# Full System Audit & Fix Plan

## What I found (live DB right now)

| Area | State | Verdict |
|---|---|---|
| Jobs scraped | 1,319 total | OK |
| "Matched" jobs | 150 | **Garbage** — includes *Technical support*, *Executive Assistant*, *SAP BTP Developer*, Chinese / Portuguese titles |
| Applications | 143 queued, 3 applying, 0 succeeded | Worker stalled |
| Worker heartbeat | last_seen 22:45 (>30 min stale) | **Offline** |
| Apify (6 actors) | All `last_run_count = 0` | **Broken** (input schema) |
| `infosec_jobs` | 0 results | **Parser broken** |
| USAJobs `:cyber` | 96 results | OK |
| Greenhouse/Lever boards | Most return 0; a few (klaviyo, mercor, modal, supabase) dump 200+ generic jobs | Wrong company list |

## Root causes

1. **Matching scores everything ≥50 by default; min_score is 20** → every job is "matched" even with zero cyber keywords. The cyber relevance gate at the adapter layer was added, but boards like `greenhouse:supabase` are flagged `CYBER_NATIVE_PROVIDERS`-bypassed or the regex is too loose.
2. **Apply worker** isn't being woken — heartbeat is stale, queue keeps growing.
3. **Apify actor payloads** still wrong — every actor returns 0 items.
4. **InfoSec adapter** (HTML scraper) selector is wrong → 0 jobs.
5. **Country/language gate** lets through CJK and Spanish titles.
6. **Resume + cover letter generation per job** exists in `src/lib/apply/ai.server.ts` but is never reached because applications never leave the `queued` phase.

---

## Plan (in order)

### 1. Fix the matcher (highest impact)
- Update `public.match_job_to_filters`: drop baseline score from 50 → 0. A job earns points **only** from keyword hits. Discard if `title_kw_hits = 0` AND `body_kw_hits < 2`.
- Bump default `min_score` on the cyber filter to **55**.
- Add a language gate: discard if title contains CJK chars or non-Latin script (when target_country='US').
- Add cyber-domain hard requirement when filter name matches `Cybersecurity`: require at least one cyber keyword in title OR ≥2 in body.
- Re-run `rescore_all_jobs_for_user` after migration.

### 2. Tighten the adapter cyber gate
- In `adapters.server.ts`, remove `CYBER_NATIVE_PROVIDERS` bypass for boards that aren't actually cyber-only.
- Run `isCyberRelevant()` against title+description for **every** non-USAJobs source.
- Drop the noise companies (klaviyo, supabase, mercor, modal) from the warm-tier seed list and replace with cyber-focused orgs (CrowdStrike, Palo Alto Networks, Snyk, Wiz, Datadog Security, Cloudflare, Okta, 1Password, HashiCorp Vault, Tenable, Rapid7, SentinelOne).

### 3. Fix Apify actor inputs
- Inspect each of the 6 Apify actor schemas and rewrite the payload builder in `adapters.server.ts` so `queries`, `location`, `country`, `maxItems` match what each actor expects.
- Log raw Apify response when 0 items returned (for diagnosis).

### 4. Fix the InfoSec HTML parser
- Re-write `fetchInfoSec` against current `isecjobs.com` markup (`.job-card` selectors changed). Add a fallback to their RSS feed.

### 5. Revive the apply worker
- Verify `bootstrap_apply_worker_cron` is scheduled in `pg_cron` and the `apply-worker` route is reachable.
- Add a watchdog: if `worker_heartbeat.last_seen < now() - 5 min` and there are queued applications, the cron route auto-kicks the worker.
- Make the route process up to `parallelism` jobs per tick (currently 1).

### 6. Wire AI generation properly per job
The apply worker should, for each queued application:
1. Generate tailored **resume** (LaTeX → PDF) via `src/lib/apply/ai.server.ts` → store in `generated_resumes` + `resumes` storage bucket.
2. Generate tailored **cover letter** via Lovable AI (`google/gemini-2.5-flash`) → `cover_letters`.
3. Attach both to `applications` row, then hand off to portal.server.ts for submission.
4. Log every step into `application_events`.

### 7. End-to-end smoke test
- Trigger one tier run → confirm only cyber jobs land.
- Manually queue 1 application → confirm resume PDF + cover letter generated and stored.
- Confirm worker picks it up and moves through phases.

---

## Files to touch
- `supabase/migrations/<new>.sql` — matcher rewrite + language gate + rescore
- `src/lib/sources/adapters.server.ts` — cyber gate tightening, Apify payloads, InfoSec parser
- `src/lib/sources/seed-slugs.ts` — replace warm-tier companies with cyber orgs
- `src/routes/api/public/hooks/apply-worker.ts` — parallelism, watchdog
- `src/lib/apply/ai.server.ts` — ensure resume + cover letter both run per job
- `src/lib/apply/portal.server.ts` — verify it consumes the generated artifacts

After this, the user should see: cyber-only jobs, every queued app gets its own tailored resume + cover letter, and the worker actually applies.

Approve to start with Step 1 (matcher migration) — that single change alone will clean up the 150 garbage matches.