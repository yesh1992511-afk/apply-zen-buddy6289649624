# Plan: Fix scraping so every enabled portal produces leads

## Root cause recap

- **REST scrapers crash on status update**: worker writes `last_run_status = "success"`, but the `run_status` enum only allows `running | succeeded | failed`. After inserting jobs, the run row write throws `22P02`, the scheduler marks the source `failed`, and the next cron tick treats it as broken.
- **Apify sources never ran**: no `APIFY_TOKEN` secret.
- **USAJobs never ran**: no `USAJOBS_API_KEY` / user-agent email.
- **Board scrapers have empty / token configs**: greenhouse/lever/ashby/workable/recruitee/teamtailor company lists are 0–2 entries and not cybersecurity-aligned.

## Fix in three tracks

### Track A — DB compat (unblock the REST scrapers now)

One migration:

1. Add `'success'` as an alias label to `public.run_status` enum so existing worker writes stop crashing. (Keeps `'succeeded'` valid for the new code path.)
2. Reset stuck sources so the UI and cron pick them back up:
   ```sql
   UPDATE sources
   SET last_run_status = NULL, last_error = NULL
   WHERE last_error LIKE '%invalid input value for enum run_status%';
   ```
   Done via `supabase--insert` (data change, not schema).

After this, the next `sources-hot-15min` / `sources-warm-*` cron tick will rerun arbeitnow, remotive, remoteok cleanly, plus builtin / weworkremotely / workatastartup which never got their turn.

### Track B — Curated company pack for board scrapers

A new server fn `seedCuratedCompanies({ pack: "cybersecurity" })` in `src/lib/sources/curated.functions.ts` that merges a hand-picked cybersecurity-heavy company list into the right board sources:

- **Greenhouse**: cloudflare, crowdstrike, datadog, okta, snowflake, gitlab, hashicorp, doordash, robinhood, instacart, coinbase, airtable, asana, plaid, stripe, airbnb, brex, ramp, mongodb, sentry, anthropic, openai (also runs on greenhouse for some)
- **Lever**: netflix, palantir, attentive, postman, brex, faire, cresta, applied-intuition, anthropic, twitch
- **Ashby**: openai, ramp, linear, vercel, retool, posthog, lattice, replicate, mercury, watershed, perplexityai, character, gem, deel
- **Workable**: doctolib, getyourguide, omio, hostaway, vodafone-careers, persistent
- **SmartRecruiters**: visa, bosch, square, ubisoft, mckesson, atos, allianz, equinix, publicissapient
- **Recruitee**: catawiki, miro, contentful, dept, omio
- **Teamtailor**: voi, klarna, polestar, mentimeter, kry, oda

Add a one-click "Load cybersecurity company pack" button on `/sources` for each board source that shows current count and merges (dedup, no overwrite of user additions).

### Track C — Surface the missing secrets

Two `add_secret` prompts triggered from `/sources` (and the Setup checklist already has hooks):

1. `APIFY_TOKEN` — unlocks Indeed, LinkedIn, Glassdoor, ZipRecruiter, Google Jobs, Wellfound. Link to apify.com/account/integrations.
2. `USAJOBS_API_KEY` + `USAJOBS_USER_AGENT_EMAIL` — unlocks federal cybersecurity roles. Link to developer.usajobs.gov.

Add a "Missing keys" banner on `/sources` listing exactly which sources are dark because of which secret, with an "Add key" button per group. The readiness checklist already covers proxy/captcha — extend the same pattern.

### Track D — Worker patch (delivered in chat, applied on VPS)

Small diff that:

- Replaces every hardcoded `"success"` literal with `"succeeded"` in source-run reporting (`sources_runner.py` / wherever `last_run_status` is written).
- Wraps the status-write in a try/except so even if a status string drifts again, the inserted jobs aren't lost and the next source in the tick still runs.
- For Apify sources, if `APIFY_TOKEN` is missing, write `last_error = "APIFY_TOKEN not configured"` and `last_run_status = 'failed'` instead of silently skipping — so the UI shows why.

## Out of scope

- Rewriting any scraper logic, adding new portals, captcha changes, or anything in the apply pipeline (worker DLQ work from last turn stays as-is).

## Order of operations

1. Migration + data reset (Track A) — immediate effect, no user input needed.
2. Curated pack + secrets banner UI (Tracks B + C in one batch).
3. Worker patch posted in chat for you to `git apply` on the VPS (Track D).

After step 1 you should see new jobs from at least 5 REST sources within 15 minutes. After step 2 + you adding `APIFY_TOKEN`, the Apify portals (Indeed/LinkedIn/Glassdoor/Zip/Google) start producing within their cadence (60–120 min). After you load the curated pack, board scrapers start producing within 3 hours.
