# JobPilot — Remaining phases to fully wire the idea

Phase A (Gmail/OTP/notifications) is done. Below is everything left from the original idea, organized so we can knock it out and then run one end-to-end test.

The **resume LaTeX→PDF flow** is the biggest piece — designed exactly as you asked: LaTeX lives in the DB and is edited/tailored in the background, the UI only ever shows a PDF. No AI is used for conversion (free TeX engine on the worker).

---

## Phase C — Resume: LaTeX in background, PDF on frontend

### How it works (no AI in the conversion path)
```text
profile/job  ──► worker tailors .tex (existing ai/resume_pipeline.py)
                         │
                         ▼
              tectonic (free, bundled in worker Docker image)
                         │   .tex → .pdf
                         ▼
         Supabase Storage  resumes/{user_id}/{resume_id}.pdf
                         │
                         ▼
       resumes.pdf_storage_path  (already in schema)
                         │
                         ▼
         Frontend: signed URL → <iframe>/<object> PDF preview
```

Tectonic is already used in `worker/app/latex/compile.py`. It's free, deterministic, no API cost. Server functions never compile — they only enqueue a `worker_commands` row of kind `compile_resume` (or `tailor_resume`) and poll `pdf_storage_path` for the result.

### C1. Server functions + worker command
- New server fns in `src/lib/resume.functions.ts`:
  - `listResumes()` — list user's resumes (template + tailored).
  - `getResumePdfUrl(resumeId)` — signed URL from `resumes` bucket (5 min TTL).
  - `saveResumeTex(resumeId, tex)` — update `tex_content`, enqueue `compile_resume`.
  - `createTailoredPreview(jobId)` — enqueue `tailor_resume` for highest-score job or specified job.
  - `getCommandStatus(commandId)` — poll for `done`/`error`.
- New worker handlers in `worker/app/commands.py`:
  - `compile_resume`: load `resumes.tex_content`, run tectonic, upload PDF to `resumes` bucket, update `pdf_storage_path`.
  - `tailor_resume`: run existing `ai/resume_pipeline.py` to produce tailored `.tex`, insert new row (`kind=tailored`), then compile.
- Also wire `notify_offline` + `notify_daily_summary` handlers (still missing from Phase A).

### C2. `/profile` → Resume tab redesign
Replace the current upload-only UI with three sub-tabs:
1. **Templates** — list of `kind=template` resumes; "Edit LaTeX" opens a Monaco editor (LaTeX mode) in a side panel; "Save & compile" triggers C1; PDF preview iframe on the right auto-refreshes when status flips to `done`.
2. **Upload .tex** — drag-drop a `.tex` file, stored as a new template, auto-compiled.
3. **Tailored preview** — "Generate preview for top job" button → calls `createTailoredPreview` → shows tailored PDF + AI cover letter draft side-by-side. Lets you sanity-check tone before the bot applies.

User never sees raw LaTeX unless they explicitly open the editor. Default view is always the PDF.

---

## Phase D — Dashboard upgrade & kill-switch (B3 + B4)

Single `/dashboard` page with:
- **Big red/green "Automation: ON / PAUSED"** toggle (writes `automation_settings.enabled`).
- 24h counters: scraped, matched, queued, applied today vs `max_applies_per_day` (progress bar), failed.
- Worker heartbeat freshness badge (green <2 min, amber 2–10, red >10).
- Per-portal rate-limit chips ("Indeed 4/10 last hour").
- Live event feed: last 10 rows from `logs` (auto-refresh every 15 s).
- Top 5 unapplied jobs by score with "Apply now" button.

---

## Phase E — Sources page polish (B1)

`/sources`: per-source "Test fetch" button enqueues a `test_source` worker command that runs one small fetch and writes count + errors back to `worker_commands.result`. UI shows the result inline. No more waiting on cron to know if Apify token is right.

---

## Phase F — Cron registration (Phase A3 leftover)

Register via `supabase--insert` (data, not migration):
- `*/5 * * * *` → `/api/public/hooks/check-heartbeat`
- `*/15 * * * *` → `/api/public/hooks/daily-summary`
- `*/10 * * * *` → new `/api/public/hooks/dispatch-sources` (triggers worker to pick up due `sources` rows; harmless if already polling).

---

## Phase G — Deploy + end-to-end smoke test

### G1. Worker bundle
```bash
scp -r worker root@147.93.47.24:/root/jobpilot/
ssh root@147.93.47.24 'cd /root/jobpilot/worker && docker compose build && docker compose up -d'
```
Bump `worker/VERSION` so the heartbeat shows the new build.

### G2. Manual checklist (you run after deploy)
1. `/notifications` → Save Gmail App Password → "Send test" → email arrives.
2. `/profile` Resume tab → upload `.tex` template → PDF preview appears within ~30 s.
3. "Generate preview for top job" → tailored PDF + cover letter render.
4. `/sources` → "Test fetch" on one Apify source → count > 0.
5. Plant fake high-score job (`update jobs set score=99 where id=…`) → notification email arrives.
6. Stop worker for 15 min → offline alert arrives.
7. Wait for `daily_summary_time` → daily summary email arrives.
8. Toggle "Automation: PAUSED" on dashboard → confirm no new applies queue.

---

## Order of execution

1. **C** (resume LaTeX↔PDF) — biggest piece, isolated.
2. **D** (dashboard + kill-switch) — builds on existing tables.
3. **E** (sources test button) — small.
4. **F** (cron registration) — one SQL call.
5. **G** (deploy + smoke test) — final.

---

## Technical notes

- All new compile/tailor work runs on the VPS worker (tectonic is Node/Cloudflare-Worker incompatible — confirmed in our runtime rules).
- Frontend never touches LaTeX engines; only renders PDFs from signed Supabase Storage URLs.
- No new tables needed — `resumes.tex_content`, `resumes.pdf_storage_path`, and `worker_commands` already exist.
- No new secrets needed.
- Cover-letter draft in C2 uses Lovable AI Gateway (free for us) via the existing `ai/cover_letter.py`.

---

## What I need from you

Just **Approve** and I'll execute C → D → E → F in batched edits, then you redeploy the worker and we run the G2 checklist together.
