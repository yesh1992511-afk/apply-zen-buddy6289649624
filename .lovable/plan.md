# Full System Build — All Phases to Production

Current state: backend (worker ~2,400 LOC, 15 source adapters, AI pipeline, LaTeX, anti-detection) is ~80% done. Frontend has CRUD scaffolds for every page. What's missing is **wiring it all together end-to-end**, hardening the rough edges, and giving you a verifiable path from "git pull on VPS" → "first auto-application sent."

I'll do this in 5 ordered phases. Each phase ends in a thing you can **see working** before I move on.

---

## Phase 1 — Backend hardening & contract lock (worker side)

Goal: worker can be deployed, heartbeats, runs a full scrape→tailor→apply loop without crashing.

1. **Heartbeat + control loop** — verify `worker/app/main.py` loops every 30s: heartbeat → poll due sources → poll queued applications → respect `automation_settings.run_24_7` + daily window + `parallelism` + `max_applies_per_day`.
2. **AI pipeline glue** — confirm `ai/resume_pipeline.py` calls DeepSeek reasoner for JD analysis → OpenAI for LaTeX marker fills → `latex/compile.py` produces PDF → uploads to `resumes` bucket → writes `resumes` row. Add fallback to OpenAI if DeepSeek errors.
3. **Apply runner** — confirm `apply/runner.py` picks queued app → loads tailored resume + cover letter → routes via portal registry → captures screenshots to `screenshots` bucket → updates `applications.status` to `applied`/`failed` with `last_error`.
4. **Sane defaults & guardrails** — never apply > N/day per user, never apply to same `dedupe_hash` twice, respect `exclude_companies`, skip jobs older than `filter.posted_within_hours`.
5. **CLI commands** — `python -m app.cli scrape <key>`, `apply <job_id>`, `tailor <job_id>` for manual ops + debugging.
6. **Dockerfile + compose** — verify Playwright Chromium installs, `/data/profiles` volume mounts, restart policy = `unless-stopped`, healthcheck calls heartbeat.

**Verify:** `ssh root@147.93.47.24 'cd /root/jobpilot/worker && docker compose logs --tail 50'` shows heartbeat ticks.

---

## Phase 2 — Server functions + deploy automation

Goal: one click in the UI does what currently requires SSH.

1. **`deployWorker` server fn** (`src/lib/worker.functions.ts`) — uses `node-ssh` to: rsync `worker/` to VPS, write `.env` from server-side secrets (`SUPABASE_SERVICE_ROLE_KEY` injected, `JOBPILOT_USER_ID` = caller's UUID), run `docker compose up -d --build`, stream logs back. Stores SSH key in `WORKER_SSH_PRIVATE_KEY` secret.
2. **`triggerScrape(sourceId)` / `triggerApply(jobId)`** — bypass cadence, set a row in a new `worker_commands` table that the worker polls every 5s.
3. **`tailorJobNow(jobId)`** — same path: queue a `tailor` command so the user can preview a resume before queuing apply.
4. **`getWorkerStatus()`** — returns heartbeat freshness + last 10 runs + queue depths.

**New migration:** `worker_commands(id, user_id, kind, payload jsonb, status, created_at, processed_at)` + RLS + GRANTs.

**Verify:** click "Deploy worker" → progress drawer streams docker logs → green checkmark in <90s.

---

## Phase 3 — Frontend polish (the parts that actually need it)

Goal: each page is usable for daily ops, not just a CRUD table.

1. **Dashboard** — KPI tiles (jobs scraped 24h, matches today, applied today, success rate 7d), 24h funnel chart (scraped→matched→queued→applied→succeeded), live worker status pill, "today's queue" list.
2. **Jobs** — virtualized table (already wired) + side drawer with full JD + "Tailor" + "Queue apply" buttons + score breakdown + dedup badge.
3. **Applications** — timeline view per job: queued → tailored → applied → result, with screenshot lightbox carousel. Filter by status.
4. **Logs** — Supabase Realtime tail (subscribe to `logs` insert), level filter, scope filter, auto-scroll toggle, pause button.
5. **Sources** — toggle, edit config JSON in a typed form (not raw JSON), "Run now" button, last-run badge with error popover.
6. **Filters** — visual builder (chips for keywords, sliders for salary/score, multi-select for seniority/locations) + live count preview ("would match 234 of last 1000 jobs").
7. **Profile** — drag-drop section reorder (experiences, education, projects, skills), markdown bullet editor, autosave with toast.
8. **Automation** — start/stop big switch, schedule grid, parallelism slider, "today's plan" preview.

---

## Phase 4 — Onboarding + Gmail OAuth

Goal: a brand-new user can go from signup → first application without docs.

1. **`/onboarding` wizard** (5 steps): basics → upload existing resume (PDF parse → prefill experiences via OpenAI) → preferences/filter → enable sources → review & deploy worker.
2. **Gmail OAuth flow** — `/api/public/oauth/gmail/start` + `/callback`, stores refresh token encrypted in `secrets_meta` rows. Used by `apply/gmail_otp.py` to read LinkedIn / Indeed OTP codes.
3. **First-run nudges** — empty-state CTAs everywhere ("No jobs yet — run a source", "No filter active — create one").

---

## Phase 5 — Reliability + observability

1. **Cron via pg_cron** — every 5min: `POST /api/public/hooks/worker-watchdog` that checks `worker_heartbeat.last_seen`; if stale > 5min, email user + show banner.
2. **Daily summary email** — pg_cron at 18:00 user-local: "Today we scraped 412 jobs, applied to 17, 14 succeeded."
3. **Cost tracker** — track Apify credits + OpenAI tokens per run, surface on dashboard.
4. **Backup** — nightly `pg_dump` of `resumes`/`applications`/`logs` to a `backups` bucket.
5. **Security pass** — run security linter, fix any RLS gaps, rotate the pasted-in-chat secrets.

---

## Technical notes

- **node-ssh package**: `bun add node-ssh` (Node-compat, works in Worker SSR via WebCrypto).
- **Realtime logs**: enable `ALTER PUBLICATION supabase_realtime ADD TABLE logs;` in Phase 3 migration.
- **Charts**: use `recharts` (already standard in shadcn stack) for funnel + KPI sparklines.
- **Drag-drop**: `@dnd-kit/sortable` for profile section reordering.
- **Resume parsing**: OpenAI `gpt-5-mini` with PDF→text via `pdf-parse` in a server fn.

---

## What you'll do between phases

- **After P1:** SSH to VPS, run `bash bootstrap.sh`, watch heartbeat go green at `/setup`.
- **After P2:** delete the worker, click "Deploy" in UI, watch it come back.
- **After P3:** sign up fresh, click through every page, give visual feedback.
- **After P4:** complete onboarding as a real user, send your first auto-application.
- **After P5:** rotate secrets, publish.

---

**Approve to start Phase 1.** I'll mark each phase done with a verification step before moving to the next so we never have a "everything looks built but nothing works" moment.
