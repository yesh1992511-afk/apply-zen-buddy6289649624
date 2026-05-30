# Fix: Admin sections 404

## Cause
`src/routes/_admin.tsx` and `src/routes/_admin/*.tsx` use the underscore prefix, which TanStack treats as a **pathless layout** — the `_admin` segment is stripped from the URL. So the admin pages actually live at `/observability`, `/system`, `/audit`, `/flags`, `/plans`.

But the sidebar (`src/components/AppSidebar.tsx`) and the tab nav inside the admin layout link to `/admin/observability`, `/admin/system`, etc. → no route matches → 404.

## Fix (rename pathless layout to a real segment)
Promote `_admin` to a real `/admin` URL segment so the existing links work and admin pages get a proper namespaced URL.

1. Rename files:
   - `src/routes/_admin.tsx` → `src/routes/admin.tsx`
   - `src/routes/_admin/audit.tsx` → `src/routes/admin/audit.tsx`
   - `src/routes/_admin/flags.tsx` → `src/routes/admin/flags.tsx`
   - `src/routes/_admin/observability.tsx` → `src/routes/admin/observability.tsx`
   - `src/routes/_admin/plans.tsx` → `src/routes/admin/plans.tsx`
   - `src/routes/_admin/system.tsx` → `src/routes/admin/system.tsx`

2. Update each file's `createFileRoute("/_admin...")` string to `createFileRoute("/admin...")` (the layout becomes `/admin`, children become `/admin/audit`, `/admin/flags`, `/admin/observability`, `/admin/plans`, `/admin/system`).

3. Add a redirect index so visiting `/admin` lands on a default tab: create `src/routes/admin/index.tsx` that throws `redirect({ to: "/admin/observability" })`.

4. Let the Router Vite plugin regenerate `src/routeTree.gen.ts` on next dev run; no manual edit.

5. Sidebar and admin tab `to` values already point to `/admin/*` — no changes needed.

## Verification
- Click each sidebar admin entry → page renders, no 404.
- Non-admin user is still redirected to `/dashboard` (the `beforeLoad` role guard is preserved verbatim).
- `/admin` itself redirects to `/admin/observability`.

## Out of scope
No changes to admin page contents, RBAC logic, billing, or profile.
