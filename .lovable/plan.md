# System audit — what's wired, what's not

I walked the whole stack (worker `commands.py` / `main.py` / `heartbeat.py` / `latex/compile.py`, all 5 portals, both cron hook routes, dashboard kill-switch + counters, sources test button, `lib/commands.ts`, `pg_cron`, all 50+ profile columns + 3 new tables). Phases C/D/E/F + profile expansion + autofill mapper are all live and correctly wired. Two real gaps remain:

## Gap 1 — Duplicate pg_cron jobs (double notifications)

`cron.job` currently has **four** jobs, two pairs hitting the same endpoint every 5/15 min:

```text
jobpilot-heartbeat-check    */5  *  *  *  *   → /api/public/hooks/check-heartbeat
jobpilot-check-heartbeat    */5  *  *  *  *   → /api/public/hooks/check-heartbeat   ← dup
jobpilot-daily-summary-tick */15 *  *  *  *   → /api/public/hooks/daily-summary
jobpilot-daily-summary      */15 *  *  *  *   → /api/public/hooks/daily-summary     ← dup
```

Fix: unschedule the two newer duplicates so each hook runs once per tick.

```sql
SELECT cron.unschedule('jobpilot-check-heartbeat');
SELECT cron.unschedule('jobpilot-daily-summary');
```

## Gap 2 — Autofill only wired on Greenhouse

The plan said "drop `autofill_form()` into LinkedIn / Lever / Workday in one line each." Currently only `greenhouse.py` calls it. That means custom screening questions on LinkedIn Easy Apply, Lever, Workday, and Indeed are NOT being answered by the profile mapper — those applies will fail or skip the question.

Fix: in each of the other four portal adapters, after the core fields are filled and just before the final Submit click, add the same try-wrapped block:

```python
from ..form_walker import autofill_form
# inside apply(), just before submit:
try:
    lists = _load_lists(profile.get("user_id"))
    await autofill_form(page, profile, lists)
except Exception:
    pass
```

`_load_lists` already exists in `greenhouse.py` — extract it to `worker/app/apply/form_walker.py` as a shared helper so all four portals can import it without copy-paste.

Files to touch:
- `worker/app/apply/form_walker.py` — add `load_lists(user_id)` helper (move from greenhouse).
- `worker/app/apply/portals/greenhouse.py` — use shared `load_lists`.
- `worker/app/apply/portals/linkedin.py` — call autofill before submit.
- `worker/app/apply/portals/lever.py` — same.
- `worker/app/apply/portals/workday.py` — same.
- `worker/app/apply/portals/indeed.py` — same.
- `worker/VERSION` — bump.

## Everything else verified ✅

- Worker scheduler: heartbeat 30s, commands 5s, sources 2m, apply 45s — all in `main.py`.
- `commands.py` handlers wired for: scrape, apply, tailor, tailor_resume, compile_resume, test_source, notify_test, notify_offline, notify_daily_summary.
- `lib/commands.ts` exports matching triggers + `waitForCommand` + `getResumePdfUrl`.
- Dashboard: live counters (15s poll), kill-switch writes `automation_settings.enabled`, heartbeat freshness badge, recent log feed, daily budget bar.
- `in_active_window()` in `main.py` honors `enabled` + `run_24_7` + daily window + tz.
- Sources page: per-row "Test fetch" button → `triggerTestSource` → `waitForCommand`.
- Cron hook routes are under `/api/public/*` (auth-bypassed) and exist on disk.
- Resume tab: PDF preview iframe, hidden LaTeX editor, Save&recompile via `compile_resume` command, signed URLs (5-min) via `getResumePdfUrl`.
- Profile: 15 tabs, readiness bar, screening-answer presets, all 50+ columns + `languages` / `certifications` / `references_list` tables with RLS + GRANTs.

## Out of scope (still your action)

Phase G deploy on `147.93.47.24` — `scp worker && docker compose build && up -d`. After that, the smoke checklist in `.lovable/plan.md`.
