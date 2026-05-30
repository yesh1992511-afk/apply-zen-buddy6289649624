# Goal

Give every interactive button across the app a consistent, polished micro-interaction layer — refresh, test, add, save, submit, action chips — so they feel "NC-level" (smooth, responsive, with visible feedback) without changing any business logic.

## Approach: one shared button enhancement, applied everywhere

Rather than animating each button file-by-file, add the animation system to the **shared `Button` component** (`src/components/ui/button.tsx`) plus a couple of utility classes. Every button in the app already routes through this component, so the polish lands globally in one edit.

## Changes

### 1. `src/components/ui/button.tsx`

- Add a base transition layer: `transition-all duration-200 ease-out active:scale-[0.97] hover:-translate-y-[1px]` to the cva base.
- Add a subtle hover glow on `default` and `secondary` variants via `hover:shadow-[0_4px_12px_-4px_color-mix(in_oklab,var(--primary)_45%,transparent)]`.
- Add a new variant `spinning` state (driven by a new `loading?: boolean` prop) that:
  - replaces the leading icon with a spinning `Loader2` from lucide-react,
  - sets `disabled` and `aria-busy`,
  - keeps the button width stable (no jump).
- Add a new `success?: boolean` prop that briefly swaps the icon to a `Check` with a `scale-in` animation for ~1.2s (used for "Test passed", "Refreshed").

### 2. `src/styles.css`

Add reusable keyframes/utilities (only if not already present):
- `@keyframes spin-smooth` (1s linear infinite) → `.animate-spin-smooth`
- `@keyframes pulse-ring` (ping-like halo) → `.btn-pulse` for primary CTAs
- `@keyframes icon-pop` (scale 0.6 → 1.1 → 1) → `.icon-pop` for success state
- `.btn-press` utility: `transition-transform active:scale-95`
- Refresh-specific: `.icon-spin-once` (single 600ms rotate) — applied to refresh icons while a query is fetching.

### 3. Refresh buttons (Dashboard "Refresh", Admin "Refresh", SyncHealthCard "Refresh")

Wire the existing TanStack Query `isFetching` flag to the new `loading` prop on the Button:
- `src/components/dashboard/SyncHealthCard.tsx`
- `src/routes/admin/observability.tsx`
- `src/routes/admin/system.tsx`
- `src/routes/admin/audit.tsx`
- `src/routes/_authenticated/dashboard.tsx` (if it has a refresh affordance)

While `isFetching` is true → icon spins, button is `aria-busy`, label stays visible. On success → 1.2s `Check` flash via the `success` prop.

### 4. "Test" / "Run" buttons (Admin → System → Command Center)

`src/routes/admin/system.tsx`:
- Each dispatch button (`pause`, `resume`, `test_apply`) uses `useMutation` already; pipe `mutation.isPending` → `loading` and `mutation.isSuccess` → brief `success` flash.
- Add a toast on success/error (using the existing `sonner` or `useToast` already in the project).

### 5. "Add" / "Save" / primary CTAs

No code changes per call site — they inherit the new base animation from the Button component. Where a form is submitting, ensure the submit button passes `loading={form.formState.isSubmitting}` (audit Profile / Filters / Automation forms and add the prop in the same edit).

## Out of scope

- No backend / server-fn changes.
- No new routes, no new tables.
- No restyle of the design tokens — only motion + the loading/success affordances.

## Verify

After build:
1. `/dashboard` → click "Refresh" on Sync Health → icon spins until data lands, then a green check flashes.
2. `/admin/system` → click "test_apply" → button shows spinner, then check, then toast.
3. Any "Save" button → on click, scales down briefly; while submitting, shows spinner.
4. Hover any primary button → subtle lift + glow; no layout shift.
5. Keyboard focus rings remain intact (no regression on `focus-visible`).
