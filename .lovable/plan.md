# JobPilot — completion log

## Just shipped (this turn)

### Profile expansion
- **Migration**: profile table got 47+ new columns (address, work authorization & visa, EEOC demographics with opt-in toggle, compensation, availability, work preferences, social links, `screening_answers` jsonb).
- **New tables** with full RLS + GRANTs: `languages`, `certifications`, `references_list`.
- **UI** (`src/routes/_authenticated/profile.tsx`): rebuilt with 15 tabs — Basic, Address, Work auth (with EEOC subsection), Comp & Availability, Preferences, Links, Experience, Projects, Skills, Education, Languages, Certs, References, Screening, Resume LaTeX.
- **Autofill readiness** progress bar at the top: shows % complete and lists missing critical fields.
- **Screening answers editor**: one-click presets for the 15 most-asked portal questions ("Authorized to work?", "Notice period?", "Salary expectation?", etc.) + free-form custom keys.

### Worker autofill mapper
- **`worker/app/apply/profile_map.py`**: 60+ ordered regex rules mapping portal question text → profile field. Handles name parts, address, work auth (sponsorship variants), comp, availability, work prefs, education, links, EEOC (gated by `share_demographics`), background checks. Fallback to fuzzy match against `screening_answers`.
- **`worker/app/apply/form_walker.py`**: portal-agnostic walker — calls `_label_for` on every visible input/select/radio, runs through the mapper, and fills text inputs / selects the best matching option / clicks matching radio. Never overwrites pre-filled values.
- **Greenhouse portal** now calls `autofill_form()` after the core fields, so any custom screening question on a Greenhouse application gets answered automatically. Same pattern can be dropped into LinkedIn / Lever / Workday in one line each.

### Dashboard kill-switch
Already shipped in the prior turn — ON/PAUSED toggle writes `automation_settings.enabled`, 24h counters, heartbeat badge, top jobs, live log feed.

### Phases C, E, F (resume LaTeX→PDF, source test button, cron) — shipped in the prior turn.

---

## Phase G — deploy + smoke test (over to you)

```bash
scp -r worker root@147.93.47.24:/root/jobpilot/
ssh root@147.93.47.24 'cd /root/jobpilot/worker && docker compose build && docker compose up -d'
```

Then run through:

1. `/profile` → fill out Basic / Address / Work auth / Comp tabs → save → readiness bar climbs to ~100%.
2. Add 3-5 entries in **Screening** (esp. "Authorized to work", "Notice period", "Salary expectation").
3. `/profile` Resume tab → upload `.tex` template → PDF preview within ~30 s.
4. `/sources` → "Test fetch" on one source → count > 0.
5. Plant a fake high-score Greenhouse job, let the bot apply, check that the screenshot shows the custom questions answered.
6. Offline alert / daily summary checks as before.
7. Dashboard kill-switch → confirm queue drains and no new applies start.

---

## Notes
- The `profile_map` rule set is additive: any new question variant is one line in `RULES`.
- EEOC fields are never filled unless `share_demographics = true`.
- New tables follow the same `owner full access` RLS as the existing list tables.
- One pre-existing linter warning ("Extension in Public" for pg_cron/pg_net) was not introduced by this work and is unsafe to fix in a migration — it's a Supabase platform-level concern.
