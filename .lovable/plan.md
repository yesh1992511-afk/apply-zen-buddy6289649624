
## Confirmation of my understanding

**Resume flow (your #5):** For each job we auto-apply to, the worker first generates a **tailored resume** (AI picks/rewrites Summary + relevant Experiences + relevant Projects from your master pool, scored against that specific JD). When filling the application form:
- **From generated resume (per-job):** Summary, Experience bullets, Project bullets, skills emphasis
- **From Profile (static):** name, email, phone, address, work auth, education, certs, languages, screening answers, demographics, salary expectations, etc.

The generated resume PDF is what gets uploaded as the "resume" attachment. Confirmed.

---

## 1. Jobs pipeline — matched-only at ingest

- Drop unmatched at ingest in `worker/app/sources/registry.py` `_run_source`: if `passes(j, active_filter)` is False → skip insert entirely (don't store, don't score).
- Same rule in the server-side ingest paths (`run-tier.ts`, `ingest-extension.ts`).
- Remove `matched=false` rows in a one-time cleanup migration.
- Simplify `jobs` query in `src/lib/queries/jobs.ts` — drop the `.eq("matched", true)` filter (everything in `jobs` is matched now). Update `jobCountsQueryOptions` to read total only.
- Add a "Discarded log" counter (count only, no rows) in `automation_runs.metadata` so user can see how many were filtered out.

## 2 + 3 + 6. Sources — big expansion + ATS improvements

**New ATS portal adapters (worker/app/sources/):**
- `ats_workday.py` — Workday CXS public JSON (`/wday/cxs/{tenant}/{site}/jobs`)
- `ats_icims.py` — iCIMS public job feed
- `ats_jobvite.py` — Jobvite XML/JSON feed
- `ats_successfactors.py` — SuccessFactors public career API
- `ats_bamboohr.py` — BambooHR `/jobs/embed2.php` JSON
- `ats_breezyhr.py` — Breezy public JSON
- `ats_personio.py` — Personio XML
- `ats_pinpoint.py` — Pinpoint public API
- `ats_rippling.py` — Rippling careers JSON

**New direct portals (free, public):**
- `dice.py`, `levelsfyi.py`, `ycombinator_jobs.py`, `cybersecjobs.py`, `dicecyber.py`, `cleared_jobs.py` (clearance)

**Curated board pack (100+ companies):** Add `worker/app/sources/curated_boards.py` shipping default board tokens for top tech / cyber / fintech / health / FAANG / unicorn companies. Backed by `src/lib/sources/curated-packs.ts` UI on the `/sources` page — toggle a whole pack on/off (e.g. "Top 50 Tech", "Cybersecurity 30", "Fintech 25").

**ATS adapter hardening:** add retry w/ exponential backoff, rotating User-Agent, optional proxy (Decodo) per request, parse `posted_at` properly across all ATS responses, capture salary ranges where exposed (Greenhouse `pay_input_ranges`, Lever `salaryRange`, Ashby `compensation`).

## 4. Parallel scraping

In `worker/app/sources/registry.py` `run_due_sources`:
- Replace serial `for r in rows: await _run_source(r)` with `asyncio.gather(*[_run_source(r) for r in due_rows], return_exceptions=True)` capped via `asyncio.Semaphore(8)` (configurable via `automation_settings.parallelism * 4`).
- Per-source timeout (180s) so one slow source doesn't block the batch.
- Same change in server-side `run-tier.ts` for the fast-path Apify/free runs.

## 5. Tailored resume as the source of truth for auto-apply

**Data model (new migration):**
- `generated_resumes` table — one row per (user_id, job_id): `tailored_summary text`, `tailored_experiences jsonb` (array of `{company, title, dates, bullets[]}`), `tailored_projects jsonb`, `tailored_skills text[]`, `pdf_storage_path text`, `model text`, `created_at`.
- Link `applications.generated_resume_id` → `generated_resumes.id`.

**Worker flow (`worker/app/apply/runner.py`):**
1. Before opening the portal, run `app/ai/resume_pipeline.py`:
   - Load full master experiences/projects from Profile tables.
   - Score each experience/project against JD with AI; pick top-N.
   - AI rewrites bullets to mirror JD keywords (truthfully — no fabrication).
   - AI writes a fresh 2–3 line summary.
   - Render via existing LaTeX template → PDF → upload to `resumes` bucket.
   - Insert into `generated_resumes`.
2. `profile_map.py` is updated so any form field that resolves to **summary / experience / projects / skills** reads from `generated_resumes` row, not the base `experiences` / `projects` tables. All other fields keep reading from `profile`.
3. Cover letter (`ai/cover_letter.py`) gets the same tailored bullets as input so it's consistent with the resume.

**UI (`src/routes/_authenticated/applications.$id.tsx`):** add a "Tailored resume" tab showing the generated summary/experience/projects diff vs. master + a "Download tailored PDF" button.

## 7. Sync worker/.env.example → Lovable Cloud secrets

Push these into Lovable Cloud Secrets (via `secrets--add_secret`) so server functions + `automation.tsx` status panel see them:

```
DECODO_USERNAME, DECODO_PASSWORD, DECODO_HOST, DECODO_PORT, DECODO_COUNTRY
CAPSOLVER_API_KEY
OPENAI_API_KEY, OPENAI_MODEL
DEEPSEEK_API_KEY, DEEPSEEK_REASONER_MODEL, DEEPSEEK_CHAT_MODEL
GMAIL_OAUTH_CLIENT_ID, GMAIL_OAUTH_CLIENT_SECRET, GMAIL_OAUTH_REFRESH_TOKEN, GMAIL_EMAIL
APPLY_EMAIL, APPLY_PASSWORD, APPLY_DEFAULT_PHONE
```

(`APIFY_TOKEN` already set.) These also need to land in the VPS worker `.env` — the bootstrap script will pull them from Supabase secrets at startup so we only manage them in one place.

Update `automation.tsx` status panels and `/setup` readiness checks to recognize all of the above (extend `DecodoStatus` pattern to `CapsolverStatus`, `GmailOauthStatus`, `DeepseekStatus`, `OpenaiStatus`).

---

## Technical details

**Files created**
- `worker/app/sources/ats_workday.py`, `ats_icims.py`, `ats_jobvite.py`, `ats_successfactors.py`, `ats_bamboohr.py`, `ats_breezyhr.py`, `ats_personio.py`, `ats_pinpoint.py`, `ats_rippling.py`
- `worker/app/sources/dice.py`, `levelsfyi.py`, `ycombinator_jobs.py`, `cybersecjobs.py`, `cleared_jobs.py`
- `worker/app/sources/curated_boards.py`
- `worker/app/ai/resume_pipeline.py` (extend existing) + new `worker/app/ai/experience_scorer.py`
- `supabase/migrations/<ts>_generated_resumes_and_matched_only.sql`
- `src/components/TailoredResumeTab.tsx`
- New status components: `CapsolverStatus`, `GmailOauthStatus`, `DeepseekStatus`, `OpenaiStatus`

**Files edited**
- `worker/app/sources/registry.py` — register all new adapters; parallel `asyncio.gather` with semaphore
- `worker/app/sources/ats_greenhouse.py`, `ats_lever.py`, `ats_ashby.py`, `ats_workable.py`, `ats_smartrecruiters.py`, `ats_recruitee.py`, `ats_teamtailor.py` — add salary parsing, retry, proxy support
- `worker/app/pipeline/normalize.py` — drop unmatched at source
- `worker/app/apply/runner.py` + `worker/app/apply/profile_map.py` — read tailored content from `generated_resumes`
- `src/routes/_authenticated/sources.tsx` — curated packs UI
- `src/routes/_authenticated/automation.tsx` — add all secret status panels
- `src/routes/_authenticated/setup.tsx` — readiness checks for new secrets
- `src/routes/_authenticated/applications.$id.tsx` — Tailored resume tab
- `src/lib/queries/jobs.ts` — drop matched filter
- `src/lib/sources/curated-packs.ts` — pack definitions
- `worker/bootstrap.sh` — pull secrets from Supabase at startup

**Migration sketch**
```sql
-- 1. Drop unmatched
DELETE FROM public.jobs WHERE matched = false;

-- 2. Generated resumes
CREATE TABLE public.generated_resumes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  job_id uuid NOT NULL,
  tailored_summary text,
  tailored_experiences jsonb NOT NULL DEFAULT '[]',
  tailored_projects jsonb NOT NULL DEFAULT '[]',
  tailored_skills text[] DEFAULT '{}',
  pdf_storage_path text,
  model text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, job_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.generated_resumes TO authenticated;
GRANT ALL ON public.generated_resumes TO service_role;
ALTER TABLE public.generated_resumes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner full access" ON public.generated_resumes
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER TABLE public.applications ADD COLUMN generated_resume_id uuid REFERENCES public.generated_resumes(id);
```

**Order of execution**
1. Migration (DB)
2. Secrets push (`add_secret` for ~15 keys)
3. Worker: new adapters + parallel scraping + matched-only ingest
4. Worker: resume_pipeline + runner integration
5. Frontend: queries, curated packs UI, status panels, applications tab

Approve and I'll start with the migration + secrets first.
