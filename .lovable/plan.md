## Goal

Make `/admin` a real, separate **super-admin** area — not visible to regular users or even the workspace **owner**. Fix the clumsy layout and the "The app encountered an error" toast on Audit log.

## 1. Backend — new `super_admin` role

Migration:
- Add `'super_admin'` to the `app_role` enum.
- Seed your account (`6143b580-…fff7`) with `super_admin` so you keep access.
- Update every RLS policy that currently grants admin pages to `owner`/`admin` so they require `has_role(auth.uid(), 'super_admin')` instead (audit_log, feature_flags, plans, system tables, observability views).
- Keep `owner`/`admin` for the normal app — they just lose `/admin` access.

No new table needed; `user_roles` already supports it.

## 2. Route gating — only super-admin

`src/routes/admin.tsx` `beforeLoad`:
- If not logged in → `redirect /admin/login` (new dedicated login).
- If logged in but not `super_admin` → `redirect /` with a toast "Admin area is restricted".
- Hide the "Admin" link in the main sidebar unless the current user has `super_admin`.

## 3. Separate super-admin login

New route `src/routes/admin/login.tsx`:
- Standalone page (no app shell), dark "console" styling, shield icon, "Super-admin access only".
- Email + password sign-in via Supabase, then verifies `super_admin` role; signs the user out and shows an error if they lack it.
- Robots noindex/nofollow.
- No "sign up" / "forgot password to create account" — recovery only.

## 4. UI polish for `/admin/*`

Rebuild `admin.tsx` shell:
- Proper console layout: fixed left rail with sections (Observability, System, Audit log, Feature flags, Plans), top bar with current super-admin email + "Exit admin" button, content area with breadcrumbs.
- Replace the cramped underline tab row with the side rail (matches the screenshot's "console" intent and removes the empty black void below content).
- Consistent card framing for empty states ("No audit entries yet" inside a centered illustration block, not a stretched empty rectangle).
- Tighten spacing, use design tokens only.

## 5. Fix the runtime error on Audit log

The red "The app encountered an error" card in your screenshot comes from `ErrorBoundaryRoute` on `/admin/audit`. Root cause: the page calls `supabase.from("audit_log").select(...)` directly from the browser, but `audit_log` RLS will reject it once policies are tightened, and the `.then()` chain doesn't handle the error → boundary triggers.

Fix:
- Move all admin data reads (audit_log, feature_flags, system stats, plans, observability) behind `createServerFn` + `requireSupabaseAuth` middleware that additionally asserts `has_role(userId, 'super_admin')`, and use the admin Supabase client so RLS doesn't bite.
- Convert the page to TanStack Query (`useQuery` + `useServerFn`) so errors surface inline ("Failed to load audit log — Retry") instead of crashing the route.
- Apply the same pattern to the other admin tabs.

## 6. Verify

- Log in as your owner account → `/admin` redirects to `/admin/login`.
- Log in at `/admin/login` with same account (now also `super_admin`) → console loads, Audit log renders without the error card.
- Create a second test user with only `owner` role → `/admin` redirects away, sidebar hides Admin link.

## Out of scope

- Separate super-admin user database (we reuse Supabase auth + role table; safer than a parallel auth system).
- Email/2FA hardening for super-admin (can add TOTP later if you want).
- Visual redesign of non-admin pages.

## Technical notes

Files touched:
- new migration: add enum value + seed + tighten RLS
- `src/routes/admin.tsx` — new shell + strict gate
- `src/routes/admin/login.tsx` — new
- `src/routes/admin/{audit,observability,system,flags,plans}.tsx` — switch to server fns + useQuery
- `src/lib/admin.functions.ts` — new server fns with `super_admin` guard
- `src/components/AppSidebar.tsx` (or wherever the admin link lives) — conditional render
