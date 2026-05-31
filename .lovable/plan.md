# Wire Completeness + Max-Coverage Auto-Apply End-to-End

## 1. Add CompletenessBar to `/setup` as a readiness row
- Edit `src/routes/_authenticated/setup.tsx` (readiness checklist page).
- Add a new row above (or as the first item in) the readiness list:
  - Render `<CompletenessBar />`.
  - Click → navigates to `/profile` (or scrolls to the weakest section).
- Re-use the same query the component already runs; no new server fn needed.

## 2. Wire field-fill ledger surfaces (finish what's half-built)
- `src/routes/_authenticated/applications.$id.tsx`
  - Confirm "Form" tab reads `applications.field_fills` and renders `<FormFillTable />` with source badges (`profile` / `tailored` / `screening_cache` / `ai_generated`).
  - Empty-state copy when ledger is empty (older applications).
- `src/components/FormFillTable.tsx`
  - Add filter chips by source + a "copy as JSON" debug action.
- `src/routes/_authenticated/profile.screening.tsx`
  - Confirm cached answers from `profile.screening_answers` load/edit/save correctly.
  - "Clear cache" button per question.

## 3. Worker: ensure the ledger actually gets written for every adapter
- `worker/app/apply/form_walker.py` — already logs text inputs + AI textareas. Extend to:
  - Selects/radios/checkboxes → record `(label, chosen_value, source)`.
  - File uploads (resume/cover) → record filename + source = `tailored`.
- `worker/app/apply/runner.py` — persist `field_fills` jsonb at end of every run (success **and** failure), not only success.
- Every ATS adapter (`ats_greenhouse.py`, `ats_lever.py`, `ats_ashby.py`, `ats_workday.py`, `ats_bamboohr.py`, `ats_breezyhr.py`, `ats_icims.py`, `ats_jobvite.py`, `ats_personio.py`) — route ALL field interactions through `safe_autofill` / `safe_select` so the ledger captures them. No more direct `page.fill()` calls bypassing the recorder.

## 4. Screening AI fallback — flag long-form for review
- `worker/app/ai/screening.py`
  - Short factual (years exp, yes/no, salary) → auto-answer, source = `ai_generated`, no flag.
  - Long-form (>15 words OR "why do you want…", "tell us about…") → auto-answer **but** set `needs_review: true` in the ledger entry and bump `applications.status` only after user confirms (or auto-submit per user's prior preference).
- Honor user's earlier choice: default to "always-AI, flag long-form".

## 5. Profile completeness — make it actually drive auto-apply
- `src/components/profile/CompletenessBar.tsx` — already measures ~28 fields. Add:
  - Click a missing-field chip → deep-link to the right `/profile/*` tab + scrolls to field.
  - Warning banner on `/automation` if completeness < 70% ("auto-apply will skip ~X% of forms").

## Technical notes
- No new migrations needed (`field_fills` jsonb + `screening_answers` jsonb already exist).
- No new secrets (uses existing `DEEPSEEK_API_KEY` / `OPENAI_API_KEY`).
- All UI changes are presentation; only worker changes touch business logic.

## Files touched
**Frontend:** `src/routes/_authenticated/setup.tsx`, `src/routes/_authenticated/applications.$id.tsx`, `src/routes/_authenticated/automation.tsx`, `src/components/FormFillTable.tsx`, `src/components/profile/CompletenessBar.tsx`

**Worker:** `worker/app/apply/form_walker.py`, `worker/app/apply/runner.py`, `worker/app/ai/screening.py`, and all 9 ATS adapters under `worker/app/sources/ats_*.py` for ledger routing.
