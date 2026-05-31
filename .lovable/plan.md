## Audit result

I traced the full pipeline (scrape → match → trigger → queue → tailor resume → generate cover letter → apply → render on `/applications/:id`). Everything in your screenshot is wired correctly **except one real bug** and one nice-to-have:

### Bug found
- `worker/app/apply/runner.py` generates the cover letter text (`cl = generate_cover_letter(...)`) and passes it to the portal adapter, but **never inserts it into `public.cover_letters`** and **never sets `applications.cover_letter_id`**.
- Symptom: on the application detail page the **Cover letter tab is always empty** ("Not generated yet"), even after a successful auto-apply. You only see resume + form fields + screenshots.

### Verified working (no change needed)
- Header "View job posting" link → opens original URL ✔
- Stepper (Optimize → Resume → Generate → Cover Letter → Submit → Done) ✔
- "Application completed / Submitted to {Company}" card ✔
- Form tab → reads from `applications.field_fills` (persisted by `worker/app/apply/field_fills.py`) ✔
- Resume tab → `applications.resume_id` → PDF preview + `generated_resumes` row for AI-tailored summary/experiences/projects/skills ✔
- Timeline tab → `application_events` ✔
- Screenshots → `applications.screenshots` (private bucket) ✔
- Retry button when `failed` / `needs_review` / `dlq` ✔
- Realtime updates on app + logs ✔

## Plan

### 1. Persist cover letter and link it (fixes the empty Cover tab)
In `worker/app/apply/runner.py`, right after `cl = generate_cover_letter(...)`:
- If `cl` is non-empty: `INSERT INTO cover_letters (user_id, job_id, name, body, kind, tone)` with `kind='tailored'`, capture the new id.
- `UPDATE applications SET cover_letter_id = <id>` for the current app.
- Wrap in try/except so a cover-letter DB write failure never aborts the apply flow.

No schema change needed — `cover_letters` and `applications.cover_letter_id` already exist.

### 2. Add inline "Job description" tab on `/applications/:id`
Today the only way to read the JD is to click "View job posting" (opens the source). Add an in-app tab so you can read what the AI used to tailor the resume/cover, side-by-side with the generated output.

In `src/routes/_authenticated/applications.$id.tsx`:
- Add `description` and `description_html` to the `applications.job:jobs(...)` select.
- Add a new left-rail entry and `<TabsContent value="jd">` that renders `description_html` (sanitized) when present, otherwise plain `description` in a `<pre>` block.
- Position it as the first tab (before Form), since users want to read the JD before the filled form.

### 3. Backfill (optional, one-shot)
For existing `applied` rows that have a `generated_resumes` row but no `cover_letter_id`, leave them as-is — re-generating cover letters for past applies costs AI tokens and they were already submitted with the right text. New applies from now on will have the cover letter properly stored.

## Technical details

**Files changed:**
- `worker/app/apply/runner.py` — insert into `cover_letters` + update `applications.cover_letter_id` after generation, before `_save_resume`.
- `src/routes/_authenticated/applications.$id.tsx` — extend `AppRow.job` type with `description` / `description_html`, extend the `.select(...)` string, add `"jd"` to the left-rail nav and a `<TabsContent value="jd">` block. Use `dangerouslySetInnerHTML` on `description_html` after a basic sanitize (strip `<script>` / `<iframe>`), fallback to `<pre>` for plain text.

**No DB migration. No new secrets. No new dependencies.**
