# JobPilot — UI/UX Overhaul Plan

## Design direction (locked)

- **Palette (Emerald Prestige):**
  - `--background` deep ink `#0a1410` / surface `#0f1f1a`
  - `--primary` emerald `#0d7a5f`, accent `#10b981`
  - `--accent-gold` `#c9a84c` (used sparingly for "premium" states: ready, success, daily-cap met)
  - `--foreground` warm cream `#f5f0e0`, muted `#a8b5a8`
  - Borders: hairline `#1f2f28` at 1px
- **Typography:** Sora (headings, 600/700, tight tracking) + Manrope (body, 400/500). Installed via `@fontsource/sora` and `@fontsource/manrope`.
- **Structure:** Persistent collapsible left sidebar (shadcn `Sidebar`, icon-collapse) + bento-grid dashboard. Numeric counters use Sora tabular-nums.
- **Motion:** subtle — 150ms ease for hovers, 250ms for panel mounts, no parallax/glitter.
- **Density:** compact but breathable — 12px gutter, 16px card padding, 24px section gaps.

## What gets rebuilt (frontend only)

### 1. Design system (`src/styles.css`)
Replace current tokens with the Emerald Prestige palette in OKLCH. Add semantic tokens: `--surface-1/2/3`, `--success` (emerald), `--warning` (gold), `--danger` (warm red), `--ring`, `--shadow-elegant`. Update both `:root` and `.dark` (default to dark).

### 2. App shell (`src/routes/__root.tsx` + new `src/components/app-sidebar.tsx`)
Wrap authenticated routes in `SidebarProvider` + persistent `AppSidebar` with sections:
- **Pilot** — Dashboard, Sources, Filters, Queue, Applications
- **Profile** — Profile, Resume, Screening
- **System** — Notifications, Logs, Settings
Header strip: breadcrumb · global kill-switch toggle · heartbeat dot · user menu.

### 3. Dashboard (`/dashboard`) — bento redesign
6-tile bento on desktop, stack on mobile:
- **Hero tile (2x1):** big "Today" counter (applied / cap), thin progress ring in gold, kill-switch CTA.
- **Heartbeat tile:** worker status dot, last-seen, version.
- **Active window tile:** mini timeline showing in/out of window for today.
- **Funnel tile:** Discovered → Scored → Queued → Applied bar.
- **Recent activity tile (2x1):** scrollable log feed with portal favicons.
- **Per-portal tile:** small stacked bars (Greenhouse, LinkedIn, Lever, Workday, Indeed).

### 4. Profile (`/profile`) — visual polish, same 15 tabs
- Vertical tab rail on desktop (left), horizontal scroll on mobile.
- Readiness becomes a top sticky band: emerald fill, gold pip at 100%, per-tab dots showing completeness.
- Form fields: consistent shadcn `Input`/`Select`/`Textarea` with floating labels, inline help, and a "Why we ask" tooltip on sensitive fields.
- Screening tab: each preset card with portal-tag chips ("LinkedIn · Greenhouse").

### 5. Resume tab — split view
Left: LaTeX editor (Monaco-like, mono font, collapsed by default).
Right: PDF iframe with skeleton + "Recompile" button + version timestamp.

### 6. Sources / Filters / Queue / Applications
Convert to consistent `DataTable` (shadcn table + tanstack-table-style header): sortable, filter chip row, row actions menu, empty state with illustration. "Test fetch" becomes inline pill with live spinner.

### 7. Auth (`/login`)
Split-screen: left = brand panel with emerald gradient + tagline + small animated heartbeat dot. Right = login form, Google button up top, email/password below.

### 8. Notifications & Settings
Card-grouped sections. Toggle rows with secondary description. Time pickers for active window.

### 9. Global components
- `StatusDot` (online/offline/idle)
- `MetricTile` (label, value, delta, optional gold accent)
- `EmptyState` (icon, title, hint, CTA)
- `PortalBadge` (favicon + name pill)
- `KillSwitch` (large toggle with confirm-on-enable)

### 10. Responsive + a11y pass
- Sidebar collapses to icon strip <1024px, sheet drawer <768px.
- All interactive elements: focus ring (`--ring`), aria-labels, keyboard nav on tabs/menus.
- Color contrast WCAG AA against `#0a1410`.

## Bug / consistency sweep (while in there)

- Standardize all toasts to `sonner` (drop any `useToast` leftovers).
- Replace ad-hoc color classes (`text-white`, `bg-zinc-…`) with tokens everywhere.
- Fix any `<Link to="…/">` trailing slashes (TanStack strict).
- Verify every protected route under `_authenticated/` has `errorComponent` + `notFoundComponent`.
- Loading skeletons replace "Loading…" text everywhere.
- Empty-state for every list view (sources, queue, applications, logs).

## Out of scope (explicit)

- No backend / worker changes.
- No new tables or RLS edits.
- No new features — purely visual + structural frontend rework.

## Technical notes

- Install: `bun add @fontsource/sora @fontsource/manrope`, import in `src/main.tsx`.
- Update `src/styles.css` `@theme` block with the new OKLCH tokens + Sora/Manrope family vars.
- New files: `src/components/app-sidebar.tsx`, `src/components/metric-tile.tsx`, `src/components/status-dot.tsx`, `src/components/portal-badge.tsx`, `src/components/empty-state.tsx`, `src/components/kill-switch.tsx`.
- Touched files (approx 18): `__root.tsx`, `_authenticated.tsx`, `dashboard.tsx`, `profile.tsx`, `sources.tsx`, `filters.tsx`, `queue.tsx`, `applications.tsx`, `notifications.tsx`, `settings.tsx`, `login.tsx`, `signup.tsx`, plus shared UI.

## Delivery order

1. Tokens + fonts + app shell + sidebar (everything else inherits).
2. Dashboard bento.
3. Profile + Resume.
4. Sources / Filters / Queue / Applications tables.
5. Auth + Notifications + Settings.
6. A11y + responsive + skeletons + empty states.