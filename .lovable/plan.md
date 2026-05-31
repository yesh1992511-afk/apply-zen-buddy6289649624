## Goal

Restructure the Jobs page to match the reference: keep the top "matched jobs" grid, then append an "All applications" section underneath with status tabs, a per-company search, an **Open tracker** button (→ existing kanban at `/applications`), and clickable company rows that open the application detail (existing `/applications/$id`).

## Scope

Frontend only. No schema, no server-fn, no business-logic changes. The kanban tracker page (`/applications`) and the application detail page (`/applications/$id`) already exist and stay as-is — we just navigate to them.

## Changes

### 1. `src/routes/_authenticated/jobs.tsx`

Below the existing job-cards grid (after line 406), add a new `<AllApplicationsSection />` block:

- **Header row**: "All applications" title on the left; on the right two buttons:
  - `Open tracker` → `<Link to="/applications">` (goes to the existing kanban view = image 2).
  - `Approve all` (disabled placeholder for now — no business logic change requested).
- **Tabs** (pill row, count badge each): `All` · `Submitted` · `In flight` (queued+applying) · `Needs you` (needs_review) · `Failed` · `Skipped`. Local `useState` for active tab.
- **Search input** on the right ("Search company…") — local filter on company name.
- **Table** with columns: Company (logo letters + title/role), Resume (Ready/—), Cover letter (Ready/—), Status (chip), Applied (timeAgo).
  - Whole row is a `<Link to="/applications/$id" params={{ id }}>` → opens existing detail page (image 3).
  - Empty state when no rows match the active tab/search.

### 2. Data source

Reuse the same query the current `/applications` page uses — a Supabase select on `applications` joined to `jobs(title, company, url)`. Extract it into `src/lib/queries/applications.ts` as `applicationsListQueryOptions()` so both the Jobs page (new table) and the Applications page (kanban) can consume it via `useQuery`, keeping a single source of truth and realtime invalidation behavior.

Status derivation for the tabs uses the existing `phase`/`status` logic already in `applications.tsx` (lifted into a small helper next to the new query).

### 3. `src/routes/_authenticated/applications.tsx`

Refactor to consume `applicationsListQueryOptions()` (drop the inline `supabase.from(...)` call + local `useState`/`useEffect`). No visual change — kanban layout stays identical (matches image 2, which is the "Open tracker" destination).

## Out of scope

- No changes to the kanban tracker visuals.
- No changes to the application detail page.
- No new business logic (Approve-all is a disabled UI affordance only).
- No data-model or RLS changes.

## Files touched

- `src/routes/_authenticated/jobs.tsx` — append All-applications section + Open tracker button.
- `src/lib/queries/applications.ts` — new shared query options + phase helper.
- `src/routes/_authenticated/applications.tsx` — switch to shared query (no UI change).
