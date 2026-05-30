## Phase 5 — Polish & First-Run UX

Backend is solid (Phases 1–4). Now focus on the surfaces users touch first: a smoother onboarding, accessibility, and mobile.

### 1. Onboarding flow
The `onboarding.tsx` and `setup.tsx` routes exist but aren't wired into the post-signup path. Goal: after first sign-in, route to `/onboarding` until the minimum profile is complete (name, email, work auth, at least one experience, default resume uploaded). Add a 4-step wizard:
1. Identity & contact
2. Work authorization & location preferences
3. One experience + skills
4. Resume upload + automation defaults (use existing `automation_settings` row)

Mark complete by setting `profile.onboarded_at`. Redirect logic in `_authenticated.tsx beforeLoad`.

### 2. Profile page UX
`profile.tsx` is 891 lines of dense forms. Without rewriting it:
- Add a sticky completion meter (already has `CRITICAL_FIELDS`) showing % done with jump-to-incomplete buttons.
- Split into the existing Tabs but persist active tab in URL search param so refresh keeps position.
- Inline validation errors via the existing `FieldError` component on blur, not just on save.

### 3. Mobile pass (≤768px)
Most pages are desktop-first. Tighten:
- App sidebar collapses to a bottom tab bar on mobile (5 primary routes: Dashboard, Jobs, Applications, Profile, More).
- `applications.$id.tsx` 280px left rail stacks above content on mobile.
- Tables (`jobs`, `applications`, `logs`) switch to card list on mobile.
- Touch targets ≥44px on action buttons.

### 4. Accessibility pass
- Add `aria-label` to all icon-only buttons (audit with `rg "<Button[^>]*size=\"icon\""`).
- Ensure all form inputs have associated `<Label>` (a few in profile use placeholder-as-label).
- Focus-visible ring on custom interactive elements (timeline screenshot button, tab triggers in detail page).
- Keyboard-navigable lightbox in `ApplicationTimeline` (ESC closes — already via Dialog; verify arrow keys for multi-screenshot).
- Color contrast check on `text-muted-foreground` over `bg-surface-2`.

### 5. Empty/loading states
- Skeletons (not spinners) on jobs/applications/logs lists.
- Empty states with one clear CTA on each list page (most have text-only "No items").

### Out of scope
- New features, billing changes, design system overhaul.

### Deliverable
Reply **"go"** to execute all 5 sections, or call out which to drop/reorder.
