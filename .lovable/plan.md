# JobPilot — completion log

## Just shipped (this turn) — closed the two wiring gaps from the audit

### Gap 1: duplicate pg_cron jobs → removed
Unscheduled `jobpilot-check-heartbeat` and `jobpilot-daily-summary` (the
newer duplicates of `jobpilot-heartbeat-check` / `jobpilot-daily-summary-tick`).
Each hook now fires exactly once per tick → no more double notifications.

### Gap 2: autofill only on Greenhouse → now on all 5 portals
- `worker/app/apply/form_walker.py`: added `load_lists(user_id)` + a
  `safe_autofill(page, profile)` one-call wrapper (loads lists, runs the
  walker, swallows all exceptions so a screening question never crashes
  an apply).
- `greenhouse.py`: switched to shared `safe_autofill`; removed local `_load_lists`.
- `linkedin.py`: `safe_autofill` inside the multi-step Next/Submit loop —
  any custom Easy Apply question on any step gets answered.
- `lever.py`: `safe_autofill` right before the final Submit click.
- `workday.py`: `safe_autofill` inside the Next/Submit loop (multi-page wizard).
- `indeed.py`: `safe_autofill` inside the Continue/Submit loop (iframe-aware).
- `worker/VERSION` → `2026.05.30-autofill-allportals`.

---

## System wiring — verified end-to-end

- **Worker scheduler** (`main.py`): heartbeat 30s, commands 5s, sources 2m, apply 45s.
- **Command bus** (`commands.py`): scrape / apply / tailor / tailor_resume /
  compile_resume / test_source / notify_test / notify_offline /
  notify_daily_summary all wired.
- **Frontend triggers** (`src/lib/commands.ts`): one helper per command +
  `waitForCommand` + `getResumePdfUrl` (5-min signed URL).
- **Dashboard** (`/dashboard`): live counters (15s poll), kill-switch writes
  `automation_settings.enabled`, heartbeat freshness badge, daily budget bar,
  recent log feed. `in_active_window()` honors enabled + run_24_7 + window + tz.
- **Sources** (`/sources`): per-row "Test fetch" → `triggerTestSource` → `waitForCommand`.
- **Cron hooks** (`/api/public/hooks/check-heartbeat`, `daily-summary`):
  unauthenticated public routes; pg_cron hits them every 5 / 15 min.
- **Resume** (`/profile` Resume tab): LaTeX editor (hidden by default) +
  PDF preview iframe; Save & recompile enqueues `compile_resume`; tectonic
  builds the PDF; signed URL served back to the iframe.
- **Profile** (`/profile`): 15 tabs, readiness bar, screening-answer presets
  for the 15 most-asked questions. 50+ columns + `languages` / `certifications`
  / `references_list` tables, all RLS-locked.
- **Autofill mapper** (`worker/app/apply/profile_map.py`): 60+ regex rules
  + fuzzy fallback against `screening_answers`. EEOC gated by `share_demographics`.

---

## Phase G — your turn (deploy + smoke test)

```bash
scp -r worker root@147.93.47.24:/root/jobpilot/
ssh root@147.93.47.24 'cd /root/jobpilot/worker && docker compose build && docker compose up -d'
```

Smoke checklist:
1. `/profile` → fill Basic / Address / Work auth / Comp → readiness bar ~100%.
2. Add 3-5 entries in **Screening** (work auth, notice period, salary).
3. `/profile` Resume tab → upload `.tex` → PDF preview within ~30s.
4. `/sources` → "Test fetch" on one source → count > 0.
5. Plant a fake high-score Greenhouse / Lever / LinkedIn job, let the bot
   apply, confirm the screenshot shows custom questions answered.
6. Pause the kill-switch → confirm no new applies start.
7. Daily summary / offline alert checks.

---

## Notes
- Adding a new question variant = one line in `profile_map.RULES`.
- EEOC fields are never filled unless `share_demographics = true`.
- The lone Supabase linter warning ("Extension in Public" for pg_cron / pg_net)
  is platform-level and was already present before this work — not safe to
  "fix" via migration.
