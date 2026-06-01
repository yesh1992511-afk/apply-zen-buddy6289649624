# Audit + polish pass for Jobs → Applications flow

## What's already correct (verified)

- `AllApplicationsTable` rows are `<Link to="/applications/$id">` — every row in every tab (All / Submitted / In flight / Needs you / Failed / Skipped) is clickable.
- `AllApplicationsKanban` cards are also `<Link to="/applications/$id">` — clickable from both the inline Jobs-page kanban and the `/applications` route.
- `jobs.tsx` cards already link to `/applications/$id` when `application_id` is present.
- `/applications/$id` already exists with: header, ApplyStepper, left rail (JD/Form/Timeline/Resume/Cover), LiveActivityPanel, JD viewer (sanitized HTML), FormFillTable, ApplicationTimeline, tailored-resume PDF iframe, cover-letter body, retry button, realtime updates.

## Gaps to fix

1. **Resume + cover signed URLs can 404 silently** — `getResumePdfUrl` is called for `resumes.pdf_storage_path` but generated tailored resumes live in `generated_resumes.pdf_storage_path` and aren't surfaced when only `generated_resume_id` is set on the application. Detail page must also resolve `generated_resume_id` → signed URL.
2. **Cover letter is text-only** — when a stored PDF exists we still render the body `<pre>` only. Show the body when present, but also offer a download/copy action.
3. **Screenshots gallery missing** — `applications.screenshots` is fetched but never rendered. Add a Screenshots tab/section with signed-URL thumbnails + lightbox.
4. **Detail header is sparse** — no score chip, no salary, no posted-date, no JD snippet. Pull these from `job:jobs(...)` (extend select with `score, salary_min/max/currency, employment_type, seniority`).
5. **Timeline tab badge** shows count but no "latest status" hero banner. Promote the most recent `application_events` row into a status banner at the top of the right pane.
6. **Mobile layout** — left rail collapses awkwardly under 768px. Convert to a top tab strip on `<lg` and keep the sidebar nav only on `lg+`.
7. **Table polish** — add Score column (from `job.score`) and a tiny portal badge next to the company name; align the empty-state CTA to "Go to Jobs".
8. **Kanban polish** — show the score pill on each card; collapse `dead_letter` under `failed` visually (group header) since users rarely distinguish them.
9. **"Approve all" button** in the table header is `disabled` placeholder — remove it (or hide) until wired, so it doesn't look broken.
10. **`applications.tsx` page title** — add filter chips (bucket tabs) above the kanban so the route is useful on its own, not just a re-render of the Jobs-page kanban.

## Files touched

- `src/routes/_authenticated/applications.$id.tsx` — extend select, resolve generated-resume URL, screenshots gallery, status banner, responsive layout.
- `src/components/AllApplicationsTable.tsx` — add Score column + portal badge, remove disabled "Approve all".
- `src/components/AllApplicationsKanban.tsx` — score pill on cards, merge dead_letter under failed.
- `src/routes/_authenticated/applications.tsx` — add bucket tab chips above the kanban (reuse `AppBucket` from queries).

## Out of scope

- No schema, RLS, or server-function changes.
- No filter behavior changes on `/jobs`.
- No new routes.
