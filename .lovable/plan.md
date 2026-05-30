## Why it's still showing

Your logged-in account has all three roles in `user_roles`: `owner`, `admin`, **and `super_admin`**. The sidebar gate is `{isSuperAdmin && renderGroup("Admin", admin)}` — it's working correctly, but since *you* are a super_admin it still renders for you on the user-side cockpit.

The intent (per your previous direction) is that admin lives **only** in the separate `/admin` console reached via `/admin-login` — never inside the regular user sidebar, regardless of role.

## Change

In `src/components/AppSidebar.tsx`:

1. Remove the `admin` nav array (lines 64–70).
2. Remove the `{isSuperAdmin && renderGroup("Admin", admin)}` line from `SidebarContent`.
3. Remove the now-unused `useRoles` import and `const { isSuperAdmin } = useRoles()` call.
4. Drop unused icon imports (`Shield`, `Filter` if only used by that array — verify).

No other files touched. The `/admin/*` routes themselves remain fully functional and still gated by the `super_admin` check in `src/routes/admin.tsx` `beforeLoad`. Super-admins continue to access them by going to `/admin-login`.

## Verify after build

- Reload `/dashboard` while logged in as your super_admin account → the "Admin" group no longer appears in the left sidebar.
- Navigate to `/admin-login` → sign in → `/admin/observability` still loads (separate console UI).
- Regular owner-only accounts see no change (they never saw it anyway).
