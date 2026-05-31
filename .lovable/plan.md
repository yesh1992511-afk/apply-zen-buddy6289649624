# Fix Jobs → Applications flow

Three improvements to make the Jobs page match the reference flow (table → kanban → detail), all reusing the existing `applicationsListQueryOptions` so data stays in one place.

## 1. Inline the kanban on the Jobs page

Today the "All applications" section has an **Open tracker** button that navigates away to `/applications`. Replace that with an **in-page view toggle** so the kanban lives on the Jobs page itself.

- `src/components/AllApplicationsTable.tsx`
  - Add a `view` state: `"table" | "kanban"`.
  - Header row: drop `Open tracker`; add a small segmented control `Table · Kanban` on the right next to the search.
  - When `view === "kanban"`, render a new `AllApplicationsKanban` component instead of the table; tabs/search row stays visible and filters both views.
- `src/components/AllApplicationsKanban.tsx` (new)
  - Compact kanban (same columns/visuals as today's `/applications` page) consuming `applicationsListQueryOptions` + `phaseOf`.
  - Cards link to `/applications/$id` (image 3).
  - Hides empty late-stage columns (follow_up_sent, replied, interview, offer, rejected, tailored, scored), matching current `/applications` behavior.
- `src/routes/_authenticated/applications.tsx`
  - Refactor to reuse the new `AllApplicationsKanban` component (single source of truth). Page becomes a thin wrapper: `<PageHeader/>` + `<AllApplicationsKanban fullHeight />`.

## 2. Polish the All-applications table (image 1)

- Tighter row height, larger company avatar with brand-color initials background.
- Status chip simplified to a single pill with colored dot (already there, just align widths so columns don't jitter).
- Add a thin top "summary" strip above tabs: total · submitted · in flight · needs you (clickable shortcuts to set the tab).
- Sticky table header inside the card; zebra hover only (no zebra rows).
- Resume / Cover letter cells show "Ready" with check icon, "Generating…" with spinner when `phase === "tailored"/"applying"`, else `—`.

## 3. Polish the application detail page (image 3)

`src/routes/_authenticated/applications.$id.tsx`:

- Two-column layout on ≥lg: left = timeline + screenshots + JD snippet; right = sticky sidebar with company card, status chip, action buttons (Retry / Discard / Open job), generated resume + cover-letter preview links, applied/queued timestamps.
- Add breadcrumb `Jobs › {company} › {title}` linking back to `/jobs`.
- Promote the latest `application_events` entry into a hero status banner (color-coded by phase) at the top.
- Keep all existing data fetching and mutations; this is presentation only.

## Out of scope

- No schema/RLS/server-function changes.
- No changes to scrape, scoring, or apply-worker logic.
- Filter behavior on `/jobs` (window, saved filters, search) is unchanged.

## Files touched

- new: `src/components/AllApplicationsKanban.tsx`
- edit: `src/components/AllApplicationsTable.tsx`
- edit: `src/routes/_authenticated/applications.tsx`
- edit: `src/routes/_authenticated/applications.$id.tsx`
