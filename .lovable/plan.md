# Goal

Tidy the Dashboard grid so the tiles line up on clean rows with even gutters — no orphan tiles wrapping under the hero, no mismatched heights.

## Current problem

The 12-col grid in `src/routes/_authenticated/dashboard.tsx` (around line 188) is misaligned:

- Hero = `lg:col-span-5 lg:row-span-2` → owns rows 1–2, cols 1–5.
- Row 1 right side: Worker `col-span-4` + Portal `col-span-3` = 7 cols (fits 6–12). ✓
- Row 2 right side: 4 × MetricTile `col-span-3` = needs 12 cols but only 7 are free → "Queued" and "Failed" wrap onto a new row under the hero, creating the empty gap you see in the screenshot.

## Fix (CSS-only, no logic change)

Edit `src/routes/_authenticated/dashboard.tsx` only:

1. **Hero**: drop `lg:row-span-2`, set `lg:col-span-6` (was 5).
2. **Worker tile**: `lg:col-span-3` (was 4).
3. **Today by portal**: `lg:col-span-3` (was 3, unchanged).
   → Row 1 = 6 + 3 + 3 = 12. Clean.
4. **Metric strip (4 tiles)**: each `lg:col-span-3` (unchanged) → Row 2 = 3+3+3+3 = 12. Clean full-width strip below.
5. **Tighten vertical gap**: change outer wrapper `space-y-6` → `space-y-5`, grid `gap-4` → `gap-5` for consistent gutters.
6. **Match heights on row 1**: add `h-full` to Worker + Portal cards so they stretch to the hero's height (hero has more inner content, so this keeps the row visually level).
7. **Skeleton grid**: mirror the same spans so the loading state doesn't jump when data arrives.

No changes to data fetching, server functions, queries, or any other file.

## Verify

After the build: load `/dashboard`, confirm hero + Worker + Portal sit on one row, all four metric tiles sit on the next row at equal width, no empty gap between them, and Month-to-date spend / Pipeline funnel / Recent activity rows below are unaffected.
