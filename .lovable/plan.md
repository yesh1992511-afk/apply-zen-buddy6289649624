# Final polish pass — close out the 4-hour scope

Previous turns shipped: design tokens + motion, shortcuts + palette + help, extension wizard, 404, EmptyState, shared primitives (Sparkline/Section/CountUp/skeletons/ErrorBoundaryRoute), Dashboard + Jobs loading states, route-level error boundaries.

What's still missing from `.lovable/plan.md`. This plan closes all of it.

## 1. Jobs — finish what was started
- Sticky filter bar with frosted blur (`surface-frost` + `top-0 sticky z-10`).
- Gradient score chip: red < 60 → amber 60–84 → emerald ≥ 85, with subtle ring.
- Saved-filter quick chips row (reads existing filters, click = applies).
- Row hover `lift` + already-staggered entry.

## 2. Applications
- Status pipeline header strip: Applied → Screen → Interview → Offer → Rejected, each with live count + active highlight.
- Per-row timeline popover (Popover) showing status changes from existing data.
- Screenshot lightbox: click capture thumbnail → Dialog with zoomable image.
- Skeleton + empty states.

## 3. Sources
- Group by Server / Extension / ATS using `Section`.
- Per-source mini `Sparkline` (last 7d ingest counts from `automation_runs`).
- Health pill (healthy / degraded / paused) derived from `last_run_status`.
- Relative last-sync time (`timeAgo`).

## 4. Setup
- Vertical stepper with completion ring (SVG circle progress).
- Per-step check animation on complete.
- Auto-scroll/resume to last incomplete step on mount.

## 5. Profile
- Tabs: Basics · Resume · Preferences · Connected accounts.
- Reuses existing fields; just reorganizes into shadcn `Tabs`.

## 6. Filters
- Side-by-side editor: rule list on left, live preview count on right (queries `jobs` with current rules, debounced).

## 7. Automation
- Primary action button state machine: Idle (outline) → Starting (spinner, amber) → Running (pulse dot, emerald) → Stopping.
- Disable during transitions.

## 8. Notifications
- Digest preview card (renders a sample of what the daily email looks like).
- Channel toggles styled as switch rows with descriptions.

## 9. Logs
- Simple virtualised list (windowing via `useRef` + scroll math, no new dep), level pill colors (info/warn/error/debug), copy-row button on hover.

## 10. Global a11y + polish
- `aria-label` audit on every icon-only button (sidebar, palette, lightbox close, etc.).
- Single `<main>` landmark in `_authenticated.tsx`.
- Focus-visible ring audit on interactive surfaces.
- `prefers-reduced-motion` honored (verify shimmer + float-in respect it).
- Toast `tabular-nums` for counts.

## 11. QA pass
- Walk every authenticated route in preview.
- Verify skeletons → empty → error boundary paths.
- Verify ⌘K, `g d/j/a/s/f/e/o/p/n/l`, `?` from each page.
- No new deps, no schema changes, no backend touches, extension + worker untouched.

## Technical notes
- All new visual logic is presentational; no server functions or migrations.
- Reuses existing primitives: `Section`, `Sparkline`, `CountUp`, `skeletons`, `ErrorBoundaryRoute`, `EmptyState`, `Kbd`, `PageHeader`.
- Status colors via existing semantic tokens; no new CSS variables unless a gap is found during the audit.

Estimated: ~2 hr to ship and QA.
