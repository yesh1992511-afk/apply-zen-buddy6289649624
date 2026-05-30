# Finish the Awwwards-level polish pass

Previous turns shipped: design tokens + motion, global shortcuts, command palette, extension wizard, 404, EmptyState. This plan closes everything else from the original 4-hour scope.

## 1. Shared primitives (foundation)
- `src/components/PageHeader.tsx` — title, eyebrow, description, action slot, animated underline.
- `src/components/Section.tsx` — consistent vertical rhythm + optional divider-soft.
- `src/components/StatCard.tsx` — animated counter (count-up), optional sparkline slot, delta chip.
- `src/components/Sparkline.tsx` — tiny SVG sparkline (no new deps).
- `src/components/skeletons/` — `TableSkeleton`, `CardSkeleton`, `ListSkeleton` with shimmer.
- `src/components/ErrorBoundaryRoute.tsx` — reusable `errorComponent` with `router.invalidate()` + `reset()`.

## 2. Dashboard (`_authenticated/index.tsx`)
- Replace stat blocks with `StatCard` + sparklines and animated counters.
- Live worker status dot (pulse) with last-run timestamp.
- Recent activity feed with float-in stagger.
- Empty + skeleton states.

## 3. Jobs (`_authenticated/jobs.tsx`)
- Sticky filter bar with frosted blur.
- Gradient score chip (red→amber→emerald) by match score.
- Row hover lift + stagger entry.
- Saved-filter quick chips.
- Skeleton table + empty state.

## 4. Applications (`_authenticated/applications.tsx`)
- Status pipeline header (Applied → Screen → Interview → Offer) with counts.
- Per-row timeline popover.
- Screenshot lightbox (Dialog) for capture previews.
- Skeleton + empty.

## 5. Sources (`_authenticated/sources.tsx`)
- Group by Server / Extension / ATS.
- Per-source mini sparkline (last 7d jobs ingested).
- Health pill (healthy / degraded / paused) + last-sync relative time.

## 6. Setup (`_authenticated/setup.tsx`)
- Vertical stepper with completion ring.
- Per-step success state with check animation.
- Resume from last incomplete step.

## 7. Profile / Filters / Automation / Notifications / Logs
- Profile: tabbed (Basics, Resume, Preferences, Connected accounts).
- Filters: side-by-side editor (rule list ↔ live preview count).
- Automation: primary action button morphs (Idle → Starting → Running) with state color.
- Notifications: digest preview card + channel toggles.
- Logs: virtualised list (simple windowing, no new dep), level pill colors, copy-row.

## 8. Global polish
- `ErrorBoundaryRoute` wired into every `_authenticated/*` route.
- Toast styling refined (frosted, tabular-nums for counts).
- Focus rings audited on every interactive element.
- Reduced-motion honored throughout (already in tokens; verify per-component).
- A11y: `aria-label` on every icon-only button; `<main>` landmark check.

## 9. QA
- Walk every route in preview; verify skeletons, empty states, error boundaries.
- Verify ⌘K, `g d/j/a/s/e`, `?` from each page.
- No new dependencies. No backend / schema changes. Existing scraping + extension untouched.

Estimated: ~2.5 hr remaining of the original 4-hour scope.