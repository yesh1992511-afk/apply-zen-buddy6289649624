## What I found

- The `jobs` table is currently empty, so there are no jobs for the dashboard to show.
- `automation_settings.enabled` is currently `false`, so cron only processes the user when triggered manually with a logged-in token or forced user ID.
- Your cybersecurity filter exists and is active: `Cybersecurity — USA`, `min_score = 20`, cyber keywords applied.
- The latest source run shows old generic sources still ran recently (`lever:mistral`, `usajobs:software`), meaning the previous source refactor likely has not been fully deployed/activated in the live runner yet.
- Apify is not throwing token errors in the latest tier run, but every Apify provider returned `0` items. That points to actor input/schema mismatch or actor choice, not your API key.
- `infosec_jobs` exists in code/database but has never run yet.
- A USAJobs run had a salary parsing insert error: `invalid input syntax for type integer: "43.54"`, which can cause chunks of otherwise valid jobs to be skipped.

## Why you are not getting cybersecurity jobs

The system is currently scraping and recording source runs, but the jobs are not being saved now. The live runner is either still using stale source data/routing or failing inserts for some sources. Also, Apify is configured with actors that return `0` with the current payload shape, so your valid API key is not enough — the actor inputs must match what each actor expects.

## Plan to fix it

1. **Make source runs actually persist jobs**
   - Fix numeric salary normalization so decimal salary values from USAJobs cannot break job inserts.
   - Ensure source upserts do not report success while saving zero jobs because of preventable mapping errors.

2. **Make cybersecurity sources first-class**
   - Force the hot tier to include `infosec_jobs` and verify it is called.
   - Keep generic remote boards, but add a pre-filter so they only save cybersecurity-relevant jobs instead of filling the pipeline with unrelated roles.
   - Ensure the warm tier uses the current cyber-focused company seed list, not old generic slugs.

3. **Fix Apify actor execution**
   - Replace/adjust Apify payloads per actor so each actor receives the query/location fields it actually expects.
   - Treat `0 items` from Apify as a visible warning in source health when the actor ran but returned nothing for cyber keywords.
   - Keep using your existing `APIFY_TOKEN`; no new key needed.

4. **Turn matching into a stricter cybersecurity gate**
   - Only save or match jobs that contain cyber keywords in title/description/company unless they come from a dedicated cybersecurity board.
   - Keep your exclude list active for sales, marketing, recruiter, intern, physical security, guard, etc.

5. **Run a controlled refresh after implementation**
   - Re-enable automation if you want it running continuously.
   - Trigger hot, USAJobs, warm, and Apify tiers for your user.
   - Check counts by source: fetched, inserted, matched, discarded.
   - Show sample matched jobs with title/company/source/score so we can verify relevance.

## Technical details

Files likely involved:

- `src/lib/sources/adapters.server.ts`
  - Normalize salary numbers safely.
  - Fix Apify actor payloads and item mapping.
  - Add cybersecurity relevance filtering for non-cyber sources.

- `src/routes/api/public/sources/run-tier.ts`
  - Make source health more honest.
  - Ensure active user settings drive source context.

- Database data updates after code changes
  - Re-enable automation if desired.
  - Clear stale source health rows if they are misleading.
  - Trigger new tier runs and inspect saved jobs.

No schema change is expected unless we decide to store more detailed Apify diagnostics.