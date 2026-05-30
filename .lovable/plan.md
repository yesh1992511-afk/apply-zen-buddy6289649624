## Mac-Level Polish Pass

A systematic visual + interaction upgrade on every authenticated screen, the extension onboarding, the command palette, and all stateful surfaces. No new features — every change is presentation, motion, or state-handling.

### 1. Global design system (foundation)

- Add a `PageHeader` component (title, eyebrow, description, trailing actions) with consistent vertical rhythm so every route shares one header signature.
- Add a `Section` / `Panel` wrapper using `surface-frost` for top-level cards and `card-glass` for nested ones — kills the inconsistent border/padding mix.
- New motion tokens in `styles.css`: `--ease-apple-out`, `--ease-apple-spring`, `--dur-fast` (140ms), `--dur-base` (220ms), `--dur-slow` (320ms). Replace ad-hoc durations.
- Refined focus ring (2px emerald + 2px background offset, Apple-style), hover lift utility (`.lift`), and a `.divider-soft` hairline.
- Tighten typography scale (display / h1 / h2 / body / caption) with `font-feature-settings` for tabular numerals on every numeric KPI.

### 2. Per-screen polish

```text
Dashboard      → KPI cards with sparklines, animated counters, live worker dot
Jobs           → sticky filter bar, score chip with gradient, row-in stagger, density toggle
Applications   → status pipeline strip, timeline view in detail, screenshot lightbox
Sources        → grouped (Server / Extension / ATS), per-source last-run sparkline, status dot
Extension      → install wizard (4 steps with progress), live capture feed, per-portal counters w/ icons
Setup          → segmented stepper, completion ring, "ready to launch" summary card
Filters        → side-by-side editor + live match preview count
Profile        → tabbed sections, completion meter, inline edit affordances
Notifications  → preview card showing exactly what the email will look like
Automation     → big primary "Run / Pause" with state morph, schedule visualised on a timeline
Logs           → virtualised list, level pill colors, sticky time gutter
```

### 3. Empty / loading / error states (every screen)

- Shared `EmptyState` component: icon-in-gradient-puck + headline + one-line + single primary CTA.
- Shared skeletons matched to each layout (not generic gray boxes — same shape as the real content).
- `ErrorBoundary` per route with retry button that calls `router.invalidate()`.
- Toast styling: refined corner radius, blur, accent stripe by intent.

### 4. Command palette upgrade

- Grouped sections (Navigate / Actions / Recent), shortcut hints rendered as Mac-style key caps (`⌘K`, `⇧⌘P`).
- Recent + frequent ordering (localStorage), fuzzy match highlights, blurred backdrop.
- Per-page contextual actions ("Run source", "Pause automation", "New filter").

### 5. Extension onboarding flow

- New `/extension` becomes a 4-step wizard: Generate token → Download → Install in Chrome → Paste token. Each step animates in, with copy-to-clipboard feedback and a "test connection" pulse when the first capture arrives.
- Live feed strip showing the last 5 captured jobs (animated entry).
- Per-portal status grid with last-seen timestamp and capture-today count.

### 6. Keyboard / a11y polish

- Global shortcuts: `⌘K` palette, `g j` jobs, `g a` applications, `g s` sources, `?` shortcut help sheet.
- Focus rings everywhere, `aria-label` on every icon button, single `<main>` per route already correct — audit and fix any gaps.
- Reduced-motion respected via `@media (prefers-reduced-motion: reduce)`.

### 7. Misc

- Favicon + app-icon refresh to match emerald/gold palette.
- 404 + not-authorized pages styled to match.
- Sidebar: active-item gradient pill, group labels in small caps, collapsed state shows tooltips.

### Scope guardrails

- No new backend logic, no schema changes, no new server functions.
- No new dependencies beyond what's already installed (uses lucide, cmdk, shadcn, Motion already in tree).
- Existing scraping / extension / auto-apply behaviour untouched.

### Order of execution

1. Foundation tokens + `PageHeader` / `Section` / `EmptyState` / skeletons (30 min)
2. Sidebar + command palette + global shortcuts (30 min)
3. Dashboard + Jobs + Applications (60 min)
4. Sources + Extension wizard (45 min)
5. Setup + Profile + Filters + Automation + Notifications + Logs (60 min)
6. Error boundaries, 404, a11y sweep, reduced-motion (20 min)
7. Visual QA at 1280 / 1440 / 1920 via browser screenshots (15 min)

Total ≈ 4 hours.