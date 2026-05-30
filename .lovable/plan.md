# Full-Platform Audit & Wiring Verification

You asked three things: (1) some sections still look like placeholder UI, (2) you don't understand how the backend syncs, (3) is the Chrome extension fully working. I'll do a structured audit and fix anything that isn't real, then hand you a one-page "how it all connects" doc.

## Part 1 — Section-by-section UI audit (read-only pass first)

I'll open each authenticated route and grade it `REAL` / `PARTIAL` / `PLACEHOLDER`:

| Section | Route | What "REAL" means |
|---|---|---|
| Dashboard | `/dashboard` | Reads live counts from `jobs`, `applications`, `automation_runs` |
| Jobs | `/jobs` | Lists rows from `jobs` table, filter chips work |
| Applications | `/applications` + `/applications/$id` | Lists `applications`, detail shows events + screenshots |
| Filters | `/filters` | CRUD against `filters` table |
| Sources | `/sources` | CRUD against `sources`, shows last run status |
| Automation | `/automation` | Edits `automation_settings`, Start/Pause writes to worker |
| Worker | `/worker` | Shows `worker_heartbeat`, can dispatch commands |
| Logs | `/logs` | Tails `logs` + `application_events` |
| Notifications | `/notifications` | Edits `notification_settings`, test send |
| Profile | `/profile` | Full US-standard form (already rebuilt) |
| Onboarding | `/onboarding` | Wizard writes to `profile.onboarding_state` |
| Billing | `/billing` | Plan + owner unlimited badge |
| Extension | `/extension` | Token mint + install steps |
| Setup | `/setup` | First-run checklist |
| Privacy | `/privacy` | Export + delete account |
| Admin (5 tabs) | `/admin/*` | Observability / System / Audit / Flags / Plans |

For each `PARTIAL` or `PLACEHOLDER` I find, I list the exact gap (e.g. "Logs page renders static rows, not querying `logs`") — then fix it in Part 4.

## Part 2 — Backend wiring map (deliverable: `BACKEND.md`)

I'll write a plain-English file at the repo root describing the loop:

```text
 Sources (LinkedIn/Indeed/Greenhouse/Extension)
        │  ingest via /api/public/sources/*
        ▼
 jobs table  ──► match_job_to_filters() trigger ──► scores + flags "matched"
        │
        ▼
 Worker polls worker_commands + matched jobs
        │  AI tailoring (Lovable AI: resume + cover letter)
        ▼
 applications (queued → running → applied/failed)
        │  emits application_events + screenshots/* in storage
        ▼
 notification_settings  ──► email summaries / failure alerts
        │
        ▼
 audit_log + usage_events  ──► /admin/observability dashboards
```

Plus a table of every server function and HTTP endpoint with: purpose, who calls it, what tables it touches.

## Part 3 — Extension end-to-end check

The extension talks to two public endpoints:
- `POST /api/public/sources/ingest-extension` — push captured jobs
- `POST /api/public/extension/error-report` — push errors

I will:
1. Verify the extension ZIP exists in `public/`, manifest is V3, content/background scripts reference the right host.
2. Verify auth uses a token from `extension_tokens` (not user session) and the ingest endpoint validates it.
3. Test ingest with `invoke-server-function`: send a fake captured job with a real token from your account, confirm a row appears in `jobs` and `match_job_to_filters` runs.
4. Confirm `extension_tokens.last_seen_at` + `captures_today` increment.
5. If anything is off, fix it.

## Part 4 — Fixes

For each gap found in Parts 1–3, I'll do the minimum surgical fix:
- Replace placeholder JSX with real queries (TanStack Query + server fns).
- Wire any disconnected "Save" / "Test" / "Run now" button to its server fn.
- Ensure every admin page reads live data.

I will NOT redesign anything visually — only make the data real.

## Part 5 — Report back

Final message to you will include:
- The graded table (Part 1) marked `REAL` after fixes.
- Link to `BACKEND.md` (Part 2).
- Extension test result with the row that appeared in your DB (Part 3).
- List of files changed.

## Out of scope (unless you say otherwise)
- Live Stripe checkout
- Real LinkedIn/Indeed automation against production sites (we'll test with seeded jobs)
- New visual design
- Mobile native apps
