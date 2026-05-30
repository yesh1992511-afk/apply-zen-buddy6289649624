# Honest audit + plan to make this actually land you a job

After reviewing everything we've built, the **UI is done** (job cards, popups, applications detail with stepper / live activity / form-fill table / resume + cover preview, sources page, source adapters). But three critical gaps mean the system **does not yet do real work**:

| # | Gap | Symptom today |
|---|---|---|
| 1 | **Zero source rows in DB** | Cron runs every 15 min but finds nothing to fetch → 0 jobs ever appear |
| 2 | **No apply worker** | Clicking "Apply" inserts a `queued` row that sits forever — no resume tailoring, no cover letter, no submission |
| 3 | **No log writer** | `logs` table has no INSERT path → Live Activity panel and Form Fill table are permanently empty |

Plus one **honest limitation** I have to flag before we build more:

> Lovable's server runtime (Cloudflare Workers) **cannot run a headless browser** (no Playwright/Puppeteer). True auto-fill on arbitrary career pages is impossible here. The realistic path is: (a) **direct REST submission** to ATS platforms that expose public application endpoints (Greenhouse, Lever, Ashby, Workable — covers thousands of companies), and (b) **AI-tailored resume + cover letter + one-click email apply** via your Gmail for the rest. That is what tsenta-style services actually do under the hood — they are not really filling 50k random forms.

---

## What I'll build

### Phase 1 — Seed the firehose (jobs start arriving)

- **Sources page**: add a big **"Enable all aggregators"** button that inserts 12 source rows (RemoteOK, Remotive, Arbeitnow, Himalayas, Jobicy, WeWorkRemotely, Greenhouse, Lever, Ashby, Workable, SmartRecruiters, Recruitee) wired to the existing adapters.
- **"Run now"** button per source — fires `/api/public/sources/run-tier` immediately so you see jobs within seconds instead of waiting for cron.
- Verify pg_cron URLs point at the stable preview URL `project--ba5780a8-...-dev.lovable.app` so they work without publishing.

### Phase 2 — Real apply worker (the missing brain)

A `/api/public/hooks/apply-worker` route (cron every 1 min, also callable on-demand) that picks the oldest `queued` application and runs:

```
queued → applying → [generate resume → generate cover letter → submit or needs_review] → applied / failed
```

Each step:
1. **Writes a log row** (`logs.scope = 'resume.generate' | 'cover.generate' | 'apply.submit' | 'form.fill.<field>'`) so the Live Activity panel and Form Fill table fill up in real time.
2. Uses **Lovable AI (`google/gemini-2.5-pro`)** to tailor a resume from your `profile + experiences + skills` against the job description, and write a matching cover letter. Saved as `resumes` + `cover_letter` rows linked to the application.
3. **Detects the portal**: if the job URL is a Greenhouse / Lever / Ashby / Workable board, POST the application directly via their public API using profile data + tailored docs → status `applied`. Otherwise mark `needs_review` with a one-click "Apply on portal" button that opens the URL and copies your tailored cover letter to clipboard.
4. On finish: write to `notification_log`, email you via Gmail if `notify_high_score` is on.

### Phase 3 — Polish the loop

- Fix `ApplyStepper` to drive purely from log scopes (the `application_status` enum is intentionally small: `queued/applying/applied/failed/needs_review/skipped` — I'll keep it as-is and use log scopes for granular progress).
- Allow `logs` INSERT from the service-role server route (no schema change — server routes use service role).
- Dashboard: wire the "Jobs found in last hour" tile + "Applications submitted today" + "Worker last run" so you can see the system is alive.
- Add a `secrets` check for `LOVABLE_API_KEY` (already set) and a "Test apply pipeline" button on Setup that runs the worker once against the most recent matched job.

### Out of scope (and why)

- **LinkedIn / Indeed auto-apply** — they ban scraping and require a real browser. Not doable from Lovable's runtime. Would need a separate worker on Fly.io/Railway.
- **Filling CAPTCHA-protected forms** — same reason.
- **PDF rendering of the tailored resume** — Phase 1 will save Markdown/text; PDF generation needs a follow-up (we'll use a pure-JS PDF lib that runs in Workers).

---

## Technical notes

**Files I'll add/edit**
- `src/routes/_authenticated/sources.tsx` — Enable-all + Run-now buttons (calls `supabase.from('sources').upsert(...)` + fetch the run-tier endpoint)
- `src/routes/api/public/hooks/apply-worker.ts` — new, the apply engine
- `src/lib/apply/ats-greenhouse.server.ts`, `ats-lever.server.ts`, `ats-ashby.server.ts`, `ats-workable.server.ts` — REST submission per platform
- `src/lib/apply/generate-resume.server.ts`, `generate-cover.server.ts` — Lovable AI calls
- `src/lib/apply/log.server.ts` — helper that writes `logs` rows via service-role client
- `src/components/ApplyStepper.tsx` — drive from log scopes
- `src/routes/_authenticated/dashboard.tsx` — add live tiles
- One migration: pg_cron job for apply-worker (every 1 min)

**Cost control**: each apply uses ~1 Lovable AI call for resume + 1 for cover letter (~$0.01 with gemini-2.5-flash for cover, gemini-2.5-pro for resume). Scoring uses the existing free SQL `match_job_to_filters` — no AI cost there. Sources are 100% free (public APIs).

**Order of execution**
1. Phase 1 (sources seed + Run-now) — 5 min, you see jobs immediately
2. Phase 2 (apply worker + log writer + AI generators + 4 ATS adapters)
3. Phase 3 (stepper rewire + dashboard tiles + test button)

After this, the real workflow is: **jobs auto-appear → you click Apply → worker generates tailored resume + cover letter → submits directly for ATS-backed jobs / queues `needs_review` for others → you review and one-click submit the rest.** That is the realistic version of what you asked for.

Approve and I'll build all three phases in one pass.
