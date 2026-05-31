
# Fix Application Detail Tabs — Batch A

Wire the `apply-worker` to write data into the tables the UI already reads from, so every tab on `/applications/$id` populates correctly. No UI/layout changes.

## Changes (all in `src/lib/workers/apply-worker.ts` + small UI fix)

1. **Cover letter → correct table**
   - Insert generated cover into `cover_letters` (kind=`generated`, job_id, body, name) instead of `resumes` with kind=`cover`.
   - Set `applications.cover_letter_id` to the new `cover_letters.id`.

2. **Cover letter fetch** (`src/routes/applications/$id.tsx`)
   - Replace hardcoded `pdf_storage_path: null` with actual `pdf_storage_path` column select.

3. **Tailored resume → `generated_resumes`**
   - Alongside the existing `resumes` insert, also insert a `generated_resumes` row with `tailored_summary`, `tailored_skills`, `tailored_experiences`, `tailored_projects`, `tex_content`, `model`, `tokens_in/out`, `cost_usd`.
   - Set `applications.generated_resume_id`.

4. **Enqueue PDF compile**
   - After saving the resume row, insert a `worker_commands` row with `kind='compile_resume'` and payload `{ resume_id, generated_resume_id }` so the compile worker fills `pdf_storage_path`.

5. **Timeline events**
   - Add `writeEvent(application_id, phase, status, message, payload)` helper that inserts into `application_events`.
   - Call it in parallel with each existing `writeLog()` at the major phases: `discovered → analyzing → tailoring_resume → generating_cover → submitting → applied/failed`.

6. **Form fills**
   - After the portal submit step, write the collected field map into `applications.field_fills` as a JSON array `[{label, value, selector}]`.
   - Also emit `form.fill.*` scoped log entries for backward compatibility.

7. **Dead branch cleanup**
   - In `src/routes/applications/$id.tsx`, change `isDone = status === "applied" || status === "submitted"` to just `status === "applied"` (the `submitted` enum value doesn't exist).

## Files touched
- `src/lib/workers/apply-worker.ts` — main rewiring
- `src/routes/applications/$id.tsx` — cover letter select + dead branch
- (No SQL migrations needed — all target tables/columns already exist.)

## Verification
- Trigger a manual apply on one queued application via existing retry button.
- Check `/applications/$id`: Form tab shows filled fields, Resume tab shows AI panel + PDF (after compile), Cover letter tab shows generated body, Timeline tab shows phase events.
