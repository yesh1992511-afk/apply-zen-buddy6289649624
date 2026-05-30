## Goal

Make the job → apply → review flow feel alive and informative:

1. Better **job cards** on the Jobs page (company, posted-time, title, experience, score).
2. A **Job Description modal** with full details + a single **Apply** button.
3. A **per-application detail page** that mirrors the uploaded reference: a stepper (Optimize → Resume → Generate → Cover Letter → Submit → Done), a left side nav (Form / Resume / Cover letter / View job posting), and a live progress feed showing what's currently happening (e.g. "Generating resume…", "Filling Legal First Name → Yeswanth", "Submitting…").
4. While anything runs in the background, the right rail shows the **live activity animation** the user described.

All changes are frontend; backend already writes the data we need (`applications`, `logs` with `application_id`, `resumes`, `screenshots[]`, `worker_heartbeat`, realtime is on for `applications` and `logs`).

---

## 1. Jobs page card redesign (`src/routes/_authenticated/jobs.tsx`)

Each job rendered as a bento-style card:

```
[Logo/initials]  Company · posted "3h ago"        [score chip]
Job Title (Sora 600)                              [portal badge]
Location · Remote · Employment type · Seniority (experience)
[ View description ]  [ Apply ]
```

- "Posted Xh / Xd ago" derived from `posted_at ?? scraped_at` using a small `timeAgo()` helper.
- "Experience" = `seniority` (fallback to parsed years if present in `raw`).
- **View description** opens a shadcn `Dialog` (`JobDescriptionDialog`) showing: title, company, location, salary, posted time, full `description_html` (sanitized) or `description` text, "View original posting" external link, and an **Apply** button.
- **Apply** button (in card and in dialog): inserts a row into `applications` with `status='queued'` for that `job_id`, toasts "Queued", and navigates to `/applications/$id`. If an application already exists, it just navigates.

## 2. New route: Application detail (`src/routes/_authenticated/applications.$id.tsx`)

Layout mirrors the uploaded screenshot, using the existing Emerald Prestige tokens:

```
Company · Job title                        [ View job posting ↗ ]
────────────────────────────────────────────────────────────────
┌─ Left rail (320px) ──────────┐  ┌─ Right pane ──────────────┐
│ [status pill]                │  │ Tab content (Form/Resume/  │
│ Stepper:                     │  │ Cover letter)              │
│  ● Optimize                  │  │                            │
│  ● Resume                    │  │ + Live activity panel      │
│  ● Generate                  │  │   (sticky, top-right):     │
│  ● Cover Letter              │  │   animated dot + current   │
│  ● Submit                    │  │   step + recent log lines  │
│  ● Done                      │  │                            │
│ ──                           │  │                            │
│ [✓] Application completed    │  │                            │
│     Submitted to {company}   │  │                            │
│ VIEW                         │  │                            │
│ • Form                       │  │                            │
│ • Resume                     │  │                            │
│ • Cover letter               │  │                            │
│ ↗ View job posting           │  │                            │
└──────────────────────────────┘  └────────────────────────────┘
```

### Data fetched (TanStack Query + Supabase)
- `applications` row by `id` (with embedded `jobs(*)`, `resumes(*)`, cover-letter resume row).
- `logs` where `application_id = id` ordered by `ts` (realtime subscribed → appended live).
- Supabase realtime channels for `applications:id=eq.$id` and `logs:application_id=eq.$id`.

### Stepper logic
Phase derived from `application.status` + most recent `logs.scope`:
- `queued` → Optimize active
- `optimizing` / scope `resume.optimize` → Resume active
- `generating_resume` → Generate active
- `generating_cover` → Cover Letter active
- `submitting` / `filling_form` → Submit active
- `applied` / `submitted` → Done complete

Each step renders the existing `StatusDot` style: green filled for completed, emerald-ringed pulse for active, muted for pending.

### Tabs (right pane)
- **Form** — table of `field → value` pairs. Source: parse `logs` where `scope = 'form.fill'` and `metadata = { field, value }`. Each new realtime log row animates in with a fade+slide (`framer-motion`), and the currently-filling row gets a shimmering left border until the next log arrives. Empty state before applying: "Form fields will appear here as we fill them."
- **Resume** — embedded PDF (iframe) for `resumes.pdf_url` when ready; skeleton + "Generating resume…" with shimmer when not.
- **Cover letter** — same pattern using the cover-letter resume record (or `applications.cover_letter_id`).

### Live activity panel (right rail, sticky top of right pane)
Always visible while `status ∉ {applied, failed}`:
- Animated emerald pulse dot.
- Current action headline derived from latest log scope: "Generating resume", "Writing cover letter", "Filling form: Legal First Name", "Submitting application".
- Last 5 log lines, monospace, color-coded by level (matches Logs page).
- Auto-scrolls; collapses to a slim status pill once `status='applied'`.

## 3. Worker-side log conventions (no code changes required for the plan, but documented)

The UI reads what the worker already writes. We rely on these `logs.scope` values; any missing ones are filled with sane fallbacks in the UI:
- `resume.optimize`, `resume.generate`, `cover.generate`
- `form.fill` with `metadata: { field, value, portal }`
- `apply.submit`, `apply.submitted`, `apply.failed`

If a scope isn't emitted yet, the stepper still advances on `applications.status` transitions, so the UI degrades gracefully.

## 4. Applications list → detail wiring

In `applications.tsx`, make each row/card a `<Link to="/applications/$id" params={{ id }}>`. Keep the existing 5-lane pipeline; just make cards clickable.

## 5. Shared components (new, in `src/components/`)
- `JobCard.tsx` — the card used in Jobs page (and reusable on Dashboard recent jobs).
- `JobDescriptionDialog.tsx` — modal with description + Apply.
- `ApplyStepper.tsx` — vertical 6-step stepper with active pulse.
- `LiveActivityPanel.tsx` — animated headline + recent logs list (uses framer-motion already in deps; if not, fall back to CSS transitions).
- `FormFillTable.tsx` — animated table of filled fields.
- `timeAgo.ts` util in `src/lib/`.

## 6. Files touched

- New: `src/routes/_authenticated/applications.$id.tsx`, the 5 components above, `src/lib/timeAgo.ts`.
- Edited: `src/routes/_authenticated/jobs.tsx` (card + dialog + apply), `src/routes/_authenticated/applications.tsx` (link rows to detail), `src/components/AppSidebar.tsx` (no nav change; just verify breadcrumb works for `/applications/$id`).

## Technical notes

- TanStack Start file-route name `applications.$id.tsx` → path `/applications/:id`.
- Use `context.queryClient.ensureQueryData` loader + `useSuspenseQuery` per project convention; add `errorComponent` + `notFoundComponent` (route returns 404 if the application doesn't belong to the user, since RLS will return no rows).
- Supabase realtime: subscribe in a `useEffect` inside the component, push new logs into the query cache via `queryClient.setQueryData`.
- Sanitize `description_html` with a tiny allowlist (no new dep — strip `<script>`/`<style>` and `on*` attrs) before `dangerouslySetInnerHTML`.
- All colors via existing emerald/gold tokens — no raw hex in components.
- No backend, schema, or worker changes in this plan. If form-fill logs aren't being emitted by the worker yet, the UI shows an empty state and the stepper still works off `applications.status`; emitting them is a separate follow-up.

## Out of scope

- Modifying the worker / Python portals to emit new log scopes (call out as follow-up if the Form tab is empty in practice).
- Adding a new "queue" backend mechanism — we reuse `applications` rows with `status='queued'`.
