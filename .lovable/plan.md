# Plan: Max-Coverage Auto-Apply

Goal: every field on every supported ATS gets auto-filled, with tailored content for experience/projects/summary and profile content for everything else. Zero manual touch unless the form asks something we genuinely don't know.

## 1. Unified field map (`worker/app/apply/profile_map.py`)

Expand `build_field_map(profile)` to expose a flat, ATS-agnostic dict with every field most ATSes ask for. Each key has multiple aliases so adapters can match by label OR id OR name.

**Identity (from `profile`)**
- first_name, last_name, full_name, preferred_name, pronouns, date_of_birth
- email, phone (E.164 + national), phone_country_code

**Address (from `profile`)**
- street_address, address_line_2, city, state_region, postal_code, country
- timezone, nationality

**Links (from `profile`)**
- linkedin_url, linkedin_username, github_url, portfolio_url, personal_website
- twitter_url, stackoverflow_url, dribbble_url, behance_url, medium_url

**Work authorization (from `profile`)**
- work_authorization, work_auth_country, visa_status, visa_expiry
- needs_visa_now, needs_visa_future, requires_sponsorship, authorized_countries
- security_clearance, has_passport, passport_country, drivers_license, has_own_transport

**Compensation & availability (from `profile`)**
- desired_salary, salary_period, current_salary, salary_currency
- notice_period_weeks, notice_period_category, earliest_start_date
- available_hours_per_week, willing_to_relocate, relocation_assistance_needed
- remote_preference, preferred_locations, travel_willingness_pct, shift_preference
- open_to_fulltime, open_to_parttime, open_to_contract, open_to_internship

**Demographics / EEO (from `profile`, only if `share_demographics=true`)**
- gender, ethnicity, veteran_status, disability_status, lgbtq_status
- consent_background_check, consent_drug_test, criminal_record_disclosure

**Tailored content (from `_tailored_lists`)**
- summary, headline
- experiences[] → {company, title, location, start_date, end_date, is_current, bullets, tech}
- projects[] → {name, description, url, bullets, tech}
- skills[]

**Master lists (from their tables)**
- educations[] → {school, degree, field, start_date, end_date, gpa}
- certifications[] → {name, issuer, issued_date, expiry_date, credential_id, url}
- languages[] → {name, proficiency}
- publications[] → {title, venue, publication_date, url, doi}
- references[] → {name, relationship, company, email, phone}

**Screening answers (from `profile.screening_answers` jsonb)**
- Pre-baked answers for the most common ATS screening questions (years of X, are you authorized, willing to relocate, etc.) keyed by normalized question text.

## 2. Smart label matcher (`worker/app/apply/label_matcher.py` — new)

A single fuzzy matcher every adapter calls when a hardcoded selector misses:

1. Read the field's `<label>`, `aria-label`, placeholder, name, id.
2. Normalize (lowercase, strip punctuation, collapse spaces).
3. Match against an alias dictionary (e.g. "first name" / "given name" / "legal first name" → first_name).
4. For yes/no questions, pattern-match keywords ("sponsorship", "authorized to work", "relocate") and pull from the profile boolean.
5. For free-text screening questions, look up `profile.screening_answers` by normalized question; if missing, fall back to a JD-aware AI completion using the tailored resume context.

This makes every adapter resilient to label drift.

## 3. Per-adapter coverage pass

For each ATS adapter under `worker/app/apply/`:
- `ats_greenhouse.py`, `ats_lever.py`, `ats_ashby.py`, `ats_workday.py`, `ats_bamboohr.py`, `ats_personio.py`, `ats_breezyhr.py`, `ats_jobvite.py`, `ats_icims.py`, `ats_smartrecruiters.py` (if present), `ats_taleo.py` (if present)

For each:
1. **Identity + address + links** — direct map.
2. **Resume + cover letter upload** — already wired; verify both PDF paths used.
3. **Repeating Experience block** — loop `experiences[]`, click "Add another" between entries, fill company/title/dates/location/bullets/tech.
4. **Repeating Projects block** (where supported) — same loop.
5. **Repeating Education block** — loop `educations[]`.
6. **Certifications / Languages / Publications / References** — fill where ATS exposes them.
7. **Work auth + demographics** — dropdowns/radio mapped from profile enums.
8. **Custom screening questions** — route through `label_matcher` → `screening_answers` → AI fallback.
9. **Final review + submit** — already wired.

## 4. AI fallback for unknown questions (`worker/app/ai/screening.py` — new)

When `label_matcher` finds a question with no profile answer:
1. Build prompt: question + JD summary + tailored resume bullets + profile basics.
2. Call DeepSeek reasoner (cheap) for the short answer.
3. Cache result in `profile.screening_answers` (jsonb) under the normalized question key so the next application is instant + free.
4. Log to `application_events` so the user sees what was auto-answered.

## 5. UI: per-application field coverage panel

Add a "Filled fields" panel on `/applications/$id` showing every field the worker filled, its value, and the source (`profile` / `tailored` / `screening_cache` / `ai_generated`). Lets the user audit and correct.

## 6. UI: screening answers editor

Add a `/profile/screening` section listing every cached screening question + answer with edit/delete. New cached answers from AI fallback show up here automatically.

## 7. Profile completeness score

On `/profile` and `/setup`, show a completeness bar: % of the flat field map that has a value. Highlight missing high-impact fields (phone, work auth, address, demographics-if-shared) so the user knows what to fill to reduce AI fallbacks.

---

## Files touched

**Worker (new):**
- `worker/app/apply/label_matcher.py`
- `worker/app/ai/screening.py`

**Worker (edited):**
- `worker/app/apply/profile_map.py` — expand to full flat map
- `worker/app/apply/runner.py` — wire label_matcher + screening cache writes
- every `worker/app/apply/ats_*.py` adapter — coverage pass

**Frontend (new):**
- `src/components/applications/FilledFieldsPanel.tsx`
- `src/routes/_authenticated/profile.screening.tsx`
- `src/components/profile/CompletenessBar.tsx`

**Frontend (edited):**
- `src/routes/_authenticated/applications.$id.tsx` — add FilledFieldsPanel
- `src/routes/_authenticated/profile.tsx` — add CompletenessBar + link to screening
- `src/routes/_authenticated/setup.tsx` — add completeness row

**Migration:**
- `application_events` already exists; add a `field_fills` jsonb column to `applications` to persist the per-application fill map for the panel (or store as an event with `phase='fill'`).

No new secrets required — uses existing OpenAI/DeepSeek keys.

## Open question

For unknown screening questions, do you want **always-AI** (auto-answer everything, fastest) or **AI-with-flag** (auto-answer but mark the application as "needs review" so you can verify before it counts as submitted)? Default I'll use: always-AI for short factual questions (years of experience, yes/no), flag for long-form ("Why do you want to work here?") so you can tweak.