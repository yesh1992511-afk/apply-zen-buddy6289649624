# Finish remaining work

Audited the codebase against the approved plan. Migration, matched-only ingest, parallel scraping, 6 new ATS adapters, curated packs UI, tailored-resume generation in `runner.py`, and the `TailoredResumePanel` are already in place. The items below are still missing or partial.

## 1. Jobs query — drop matched filter (#1)

`src/lib/queries/jobs.ts` still has `.eq("matched", true)` and a `matchedRes` count. Since ingest now drops unmatched at the source, every row in `jobs` is matched.
- Remove the `.eq("matched", true)` on line 153.
- Collapse `useJobCounts` to return a single `count` (rename UI usages accordingly, or keep `{scraped, matched}` both pointing at the same count for back-compat).

## 2. profile_map.py & cover letter use tailored content (#5)

`runner.py` already passes `profile["_tailored_lists"]`, but `profile_map.py` and `ai/cover_letter.py` don't read it yet.
- `worker/app/apply/profile_map.py`: when resolving fields that map to `summary`, `experiences`, `projects`, `skills`, prefer `profile["_tailored_lists"]` over the base tables. All other fields keep reading from `profile`.
- `worker/app/ai/cover_letter.py`: accept the tailored summary + top experiences/projects and feed them into the prompt so cover letter and resume stay consistent.

## 3. Automation status panels (#7)

`src/routes/_authenticated/automation.tsx` only has `DecodoStatus`. Add sibling components following the same pattern (server-fn check + green/red badge):
- `CapsolverStatus` — `CAPSOLVER_API_KEY`
- `OpenaiStatus` — `OPENAI_API_KEY`, `OPENAI_MODEL`
- `DeepseekStatus` — `DEEPSEEK_API_KEY`, `DEEPSEEK_REASONER_MODEL`, `DEEPSEEK_CHAT_MODEL`
- `GmailOauthStatus` — `GMAIL_OAUTH_CLIENT_ID/SECRET/REFRESH_TOKEN`, `GMAIL_EMAIL`
- `ApplyIdentityStatus` — `APPLY_EMAIL`, `APPLY_PASSWORD`, `APPLY_DEFAULT_PHONE`

Group them under a "Worker secrets" card. Extend the existing `readiness.functions.ts` server fn so it returns presence flags for all of the above (presence only, never values).

## 4. Setup readiness (#7)

`src/routes/_authenticated/setup.tsx` has no checks for the new secrets. Add a "Worker integrations" checklist row per group above, using the same readiness server fn. Each row links to Connectors when missing.

## 5. bootstrap.sh syncs secrets from Lovable Cloud (#7)

`worker/bootstrap.sh` currently doesn't pull secrets. On VPS startup, fetch all worker secrets from Supabase Vault (or a new internal `/api/public/worker/env` endpoint guarded by `WORKER_SHARED_TOKEN`) and write them to `worker/.env`. This way we only manage secrets in Lovable Cloud.

## 6. ATS hardening (#3/#6)

Touch `ats_greenhouse.py`, `ats_lever.py`, `ats_ashby.py`, `ats_workable.py`, `ats_smartrecruiters.py`, `ats_recruitee.py`, `ats_teamtailor.py`:
- Wrap HTTP calls in a shared `worker/app/sources/_http.py` helper with: exponential backoff (3 tries), rotating User-Agent pool, optional Decodo proxy when `DECODO_*` env is set.
- Parse salary fields: Greenhouse `pay_input_ranges`, Lever `salaryRange`, Ashby `compensation.compensationTierSummary`. Write into `salary_min` / `salary_max` / `salary_currency`.

## 7. Extra free sources (#2/#6)

Add the public boards that were promised but not yet shipped:
- `worker/app/sources/dice.py` (Dice RSS / JSON feed — tech)
- `worker/app/sources/ycombinator_jobs.py` (YC Jobs JSON)
- `worker/app/sources/cybersecjobs.py` (cybersecjobs.com RSS)
- `worker/app/sources/cleared_jobs.py` (clearedjobs.net RSS — US security-cleared roles)
- `worker/app/sources/levelsfyi.py` (levels.fyi public job board)

Register each in `registry.py` `ADAPTERS`. Skip SuccessFactors/Pinpoint/Rippling for now — they're closed feeds requiring per-tenant credentials.

---

## Order of execution

1. `queries/jobs.ts` cleanup
2. `profile_map.py` + `cover_letter.py` tailored reads
3. New ATS HTTP helper + salary parsing (existing 7 adapters)
4. 5 new public sources + registry registration
5. `automation.tsx` status panels + `readiness.functions.ts` extension
6. `setup.tsx` readiness rows
7. `bootstrap.sh` secret sync

No new migrations or secrets needed — everything already exists in Lovable Cloud.

Approve and I'll execute top-to-bottom.
