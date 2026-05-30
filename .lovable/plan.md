# Finish JobPilot — remaining phases + Profile-for-Autofill expansion

Phases C, E, F were shipped in the last turn (resume LaTeX→PDF, sources test, cron). What's still open from the original idea:

1. **Phase D** — Dashboard kill-switch + live counters (partially shipped, needs the missing pieces verified end-to-end).
2. **Profile expansion** — add every field the major portals ask, with structured storage so the worker autofill can match them 1:1.
3. **Worker autofill mapping** — teach the apply bot to read the new fields and fill them on Indeed / LinkedIn Easy Apply / Greenhouse / Lever / Workday / generic forms.
4. **Phase G** — deploy + smoke test.

---

## 1. Profile expansion (biggest piece)

### 1a. New `profile` columns (one migration)
Grouped by what portals actually ask. All nullable so existing rows keep working.

**Identity & contact**
- `preferred_name`, `pronouns`, `date_of_birth` (date), `nationality`, `country`, `state_region`, `city`, `postal_code`, `street_address`, `address_line_2`

**Work authorization (every portal asks these)**
- `work_auth_country` (text, e.g. "US"), `visa_status` (e.g. "H1B", "Citizen", "PR", "Student F1"), `visa_expiry` (date), `needs_visa_now` (bool), `needs_visa_future` (bool), `authorized_countries` (text[])

**Demographics / EEOC (US portals — optional, user-controlled)**
- `gender`, `ethnicity`, `veteran_status`, `disability_status`, `lgbtq_status` — each text + a master toggle `share_demographics` (bool, default false). We only auto-fill these when the toggle is on.

**Compensation & availability**
- `desired_salary` (int), `salary_period` ('yearly'|'hourly'), `current_salary` (int), `notice_period_weeks` (int), `earliest_start_date` (date), `available_hours_per_week` (int), `open_to_contract` (bool), `open_to_fulltime` (bool), `open_to_parttime` (bool), `open_to_internship` (bool)

**Work preferences**
- `desired_titles` (text[]), `desired_industries` (text[]), `excluded_industries` (text[]), `travel_willingness` (text, e.g. "0-25%"), `shift_preference` (text), `security_clearance` (text), `drivers_license` (bool), `has_own_transport` (bool)

**Languages**
- New table `languages(user_id, name, proficiency)` with the same RLS as the other list tables.

**Certifications**
- New table `certifications(user_id, name, issuer, issued_date, expiry_date, credential_id, url)`.

**References**
- New table `references_list(user_id, name, relationship, company, email, phone)` (named `references_list` to avoid the SQL reserved word).

**Identity documents (free-text only — never store PII numbers)**
- `has_passport` (bool), `passport_country` (text), `linkedin_username` (text — separate from URL for portals that just want the handle), `twitter_url`, `stackoverflow_url`, `personal_website`, `dribbble_url`, `behance_url`, `medium_url`

**Voluntary screening answers** (portals repeat these constantly)
- `screening_answers` (jsonb) — free-form key→answer dictionary. Lets the user pre-answer "Are you legally authorized to work in X?", "Will you relocate?", "Why are you leaving your current role?" once. The autofill bot does fuzzy-match question→key.

All new columns/tables get RLS scoped to `auth.uid()` and `GRANT`s to `authenticated`+`service_role` (no `anon`).

### 1b. Profile UI redesign
Restructure `/profile` tabs into:
- **Basic** (name, contact, address)
- **Work authorization** (visa block + EEOC subsection behind the `share_demographics` toggle)
- **Preferences** (comp, availability, titles, industries, travel, clearance)
- **Experiences / Projects / Skills / Education** (existing)
- **Languages / Certifications / References** (new list sections, reusing the existing `ListSection` component)
- **Links** (all social/portfolio URLs in one grid)
- **Screening answers** (key/value editor — add common presets with one click: "Are you 18+", "Can you work in {country}", "Will you relocate", "Notice period", "Reason for leaving", "Salary expectation")
- **Resume LaTeX** (existing, untouched)

A new server fn `getProfileCompleteness()` returns a 0-100 score + a list of missing critical fields; the Profile page shows it as a progress bar so the user knows what's still empty.

### 1c. Cover-letter context
`ai/cover_letter.py` already reads the profile row. After the migration, also feed it `desired_titles`, `summary`, top 3 experiences, and `screening_answers` so generated letters reflect the richer profile.

---

## 2. Worker autofill mapping

New file `worker/app/apply/profile_map.py` exporting one function:

```python
def answer_for(question_text: str, profile: dict, lists: dict) -> str | bool | None
```

It normalizes the portal's question text (lowercase, strip punctuation) and runs it through an ordered list of regex→field mappings, e.g.:
- `r"first name"` → `profile['full_name'].split()[0]`
- `r"authori[sz]ed to work"` → `profile['work_auth_country']` match
- `r"require.*sponsor"` → `profile['requires_sponsorship']`
- `r"notice period"` → `profile['notice_period_weeks']`
- `r"desired salary|salary expectation"` → `profile['desired_salary']`
- …~60 mappings total covering Indeed/LinkedIn/Greenhouse/Lever/Workday common questions.

Fallback: fuzzy lookup in `profile['screening_answers']`.

`worker/app/apply/easy_apply.py`, `greenhouse.py`, `lever.py`, `workday.py`, and `generic_form.py` all switch their per-field branches to call `answer_for(...)` so any future portal that asks a new variant just needs a regex added in one file.

---

## 3. Phase D — Dashboard verification

Confirm the dashboard already has:
- ON/PAUSED toggle (writes `automation_settings.enabled`) ✓ shipped
- 24h counters (scraped/matched/queued/applied/failed)
- Heartbeat freshness badge
- Top-N unapplied jobs with "Apply now"
- Live log feed (auto-refresh)

Anything missing from this list gets added in the same pass.

---

## 4. Phase G — Deploy + smoke test

Same as before:
1. `scp -r worker root@147.93.47.24:/root/jobpilot/`
2. Rebuild + restart docker compose
3. Run the 8-step manual checklist (now extended to include filling out a Greenhouse test form to verify the new autofill mapping).

---

## Technical notes
- One migration (columns + 3 new tables + RLS + GRANTs).
- One new server fn file (`src/lib/profile.functions.ts`) for completeness scoring; everything else uses the existing browser supabase client + RLS.
- No new secrets, no new buckets, no new deps.
- Worker change is additive — old apply flows keep working until they're switched over branch by branch.

---

## What I need from you
**Approve** and I'll execute in this order: migration → profile UI → worker autofill mapper → dashboard verification → handoff for redeploy.