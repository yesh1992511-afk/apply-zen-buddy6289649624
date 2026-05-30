# Make it professional + actually working

Current state: backend (sources adapters, run-tier, apply-worker, AI tailoring, log writer, cron, ATS detection) is built — but **the database is empty** (0 sources, 0 jobs, 0 applications, 0 logs). Nothing is flowing because no source rows were ever inserted for your user. The UI also still reads like a prototype in a few places. Plan below fixes both.

## Phase A — Make jobs actually appear (highest priority)

1. **Auto-seed sources on first sign-in.** Add a trigger / server function that, the first time a user lands on `/sources` or `/dashboard`, inserts the full default set (12 aggregators + ~200 high-signal ATS company slugs) as `enabled=true`. No clicking required.
2. **Run-now on the Sources page**: a prominent "Fetch jobs now" button that calls `/api/public/sources/run-tier?tier=hot&user_id=<me>` and streams a toast per source ("RemoteOK: 47 new, Greenhouse/stripe: 3 new…"). User sees jobs in <30s instead of waiting for cron.
3. **Verify pg_cron** targets the stable preview URL and is actually firing — surface "Last cron run: 4 min ago • next in 11 min" on the Sources page header so failure is visible.
4. **Backfill match scoring**: if a user has no `filters` row yet, auto-create a permissive default so incoming jobs aren't all dropped.

## Phase B — Apply pipeline end-to-end test

5. **One-click "Test the pipeline" on Setup**: queues a fake application against the highest-scoring matched job, runs the worker inline (not via cron), and walks the user through the stepper live so they can see resume → cover → submit/needs_review actually work.
6. **Apply-worker resilience**: retry with backoff on transient errors, cap attempts at 3, surface `last_error` in the application detail header with a "Retry" button.
7. **PDF rendering** of tailored resume using `@react-pdf/renderer` (pure-JS, Workers-safe) so `needs_review` jobs have a downloadable PDF, not just markdown.
8. **Notification on every applied / needs_review** via the existing Gmail path — already wired, just needs the worker to call it on terminal status.

## Phase C — Mac-level UI polish

This is the visible "professional" lift. Applied consistently across all 11 authenticated routes.

- **Type system**: SF Pro Display for headings, Inter for body, tabular numerals for all counts/timestamps/scores. Tight tracking on large headers (-0.02em), generous leading on body (1.55).
- **Surface system**: layered translucent surfaces (`bg-card/60 backdrop-blur-xl` + 1px hairline border in `--border/40`), soft inner highlight on top edge — the "frosted glass over a dark canvas" feel of macOS Sonoma/Sequoia.
- **Motion**: 180ms cubic-bezier(0.2, 0.8, 0.2, 1) on every state change, scale-on-press (0.98) on primary buttons, list rows animate in with a 20ms stagger. No bouncy springs, no long fades.
- **Density**: 8px grid everywhere, 14px base font in tables, 13px in chips/badges, generous 24–32px section gutters. Remove the prototype-feeling 16px gaps.
- **Color discipline**: collapse the palette to ~7 semantic tokens (bg, surface, surface-elevated, border, text, text-muted, accent + 4 status colors). Audit and replace any raw `text-white`, `bg-zinc-*`, `bg-black/50` etc. with tokens.
- **Iconography**: switch to Lucide at a single 16px size in tables and 20px in nav, 1.5px stroke. No emoji as UI.
- **Empty states**: every page that can be empty (Jobs, Applications, Logs, Sources before seed) gets a real empty state — short headline + one primary action + small illustration in a single accent color.
- **Job card refinements**: company favicon (via duckduckgo favicon API), salary as `$120k–$160k` tabular, posted time as `2h ago` with hover-tooltip absolute time, match score as a compact ring (not a giant pill), tags truncated to 3 + `+4 more`.
- **Stepper**: switch from horizontal pills to a Apple-Health-style vertical thread with live pulse dot on the active step.
- **Tables**: zebra removed, replaced with hover-only highlight; sticky header with subtle blur; column resize handles.
- **Top bar**: collapse the two header rows on Applications/Jobs into one with inline search + filter chips.

## Phase D — Trust & professionalism details

- **Status badge in the global header**: green "Operational" dot when worker heartbeat <5min old, amber "Idle" 5–30min, red "Offline" >30min — click to see last 20 worker runs.
- **Cost meter**: show today's Lovable AI spend in the footer ($0.04 / $5 cap) so the user trusts what's running.
- **Audit log page** (`/logs` already exists): filter chips by scope, copy-as-cURL for any failed API call, "Reply with this error" button that prefills a support email.
- **Keyboard**: ⌘K command palette (jump to any route, "Apply to top match", "Run sources now", "Pause worker"). This single feature is what makes apps feel Mac-native.

## Technical notes

**Files I'll add**
- `src/lib/sources/seed.server.ts` — default source set + `ensureSourcesSeeded(userId)`
- `src/components/CommandPalette.tsx` — ⌘K palette
- `src/components/StatusPill.tsx` — operational/idle/offline header pill
- `src/components/CostMeter.tsx` — daily AI spend footer
- `src/components/EmptyState.tsx` — reusable
- `src/lib/apply/pdf.server.ts` — `@react-pdf/renderer` resume PDF
- One migration: ensure pg_cron job for apply-worker exists, add `notify_on_apply` defaults

**Files I'll edit (polish pass)**
- `src/styles.css` — token cleanup, type ramp, motion variables
- `src/routes/__root.tsx` — global header with StatusPill + ⌘K mount + CostMeter footer
- All 11 `_authenticated/*.tsx` routes — density, surface, empty state pass
- `src/components/ApplyStepper.tsx` — vertical thread redesign
- `src/components/JobCard.tsx` (and Bento variants) — favicon, ring score, tabular nums
- `src/routes/_authenticated/sources.tsx` — Run-now + last-cron header + seed-on-load
- `src/routes/_authenticated/setup.tsx` — "Test the pipeline" button

**Out of scope (unchanged from prior plan)**
- LinkedIn / Indeed auto-apply (requires real browser, not possible in this runtime)
- CAPTCHA solving
- Any third-party paid proxy / scraping service

**Order**
A (1 hr — you see jobs) → B (1 hr — you successfully apply once end-to-end) → C (2 hr — Mac polish) → D (1 hr — trust details). I'll do them in one pass.

Approve and I'll build everything.
