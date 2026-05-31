## Overview
Display the match score and an "applied / queued / failed" status badge directly on every matched job card so the user can scan the grid and instantly know which jobs have already been actioned.

## Current State
- The score is already rendered as a coloured pill in the top-right corner of each card.
- There is **no** visible indicator showing whether a job has an existing application (queued, applying, applied, failed, etc.).
- The `jobsQueryOptions` fetches `*` from `jobs` only; it does not join `applications`.

## Proposed Changes

### 1. Backend query (`src/lib/queries/jobs.ts`)
- Modify `jobsQueryOptions` to use a Supabase relation join that pulls the latest `applications` row for each job.
- Since `applications(job_id)` references `jobs(id)`, PostgREST supports `jobs(applications(status))` as an array.
- Extract the first element in the queryFn and expose it as `application_status: string | null` on the `Job` type.
- This avoids an extra network round-trip and keeps card rendering synchronous.

### 2. Card UI (`src/routes/_authenticated/jobs.tsx`)
- Add an inline status badge between the title row and the metadata row.
- Badge states and colours:
  - **Applied** → emerald green badge
  - **Queued / Applying** → amber badge
  - **Failed / Needs Review** → rose/destructive badge
  - **Skipped** → muted grey badge
  - **No application** → nothing shown (no badge)
- When an application exists, replace the "Apply" button label with context:
  - "Applied" → link to the existing application detail page
  - "Queued / Applying" → show "In progress" with a spinner hint
  - "Failed / Needs Review" → show "Retry" instead of "Apply"
  - "Skipped" → still allow re-apply
- Keep the existing score pill unchanged in the top-right corner.

### 3. No other changes
- No database migrations required.
- No worker or backend logic changes required.
- The existing `useApplyToJob` mutation already handles duplicate applications; we only surface that state earlier in the UI.

## Acceptance Criteria
- Every matched job card shows its score (already true) **and** an application status badge when an application exists.
- The user can tell at a glance which jobs are already applied, queued, or failed without opening each card.
- Clicking the card action button adapts its label based on the existing application status.