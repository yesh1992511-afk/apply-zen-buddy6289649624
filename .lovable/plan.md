## Step 1 — Deploy the worker to your server

The Lovable app is just the UI + database. All real work (job scraping, AI resume tailoring, LaTeX→PDF, browser-driven auto-apply) runs in `/worker` (Python + Playwright + Tectonic, dockerized). It's offline right now — that's why your resume preview hangs.

We'll get it running first. Everything else (resume template, sources, filters, Gmail OTP, auto-apply) depends on this.

---

### 1.1 — On your server: clone + prepare

```bash
git clone <your-repo-url> jobpilot
cd jobpilot/worker
cp .env.example .env
```

### 1.2 — Get the minimum secrets you need to START

You can run the worker with just the **core 3** and add the rest later (scrapers/applies will skip features whose keys are missing). Minimum to bring the worker online:

| Variable | Where to get it |
|---|---|
| `SUPABASE_URL` | I'll give it to you: `https://iarfebnnnoswymgfvnel.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Already stored in Lovable secrets — I'll show you how to reveal it |
| `JOBPILOT_USER_ID` | Your user UUID — I'll query the DB and tell you |

With just these 3, the worker will start, send heartbeats, and unblock the "Worker offline" state in the UI. You'll then be able to compile resumes (after Step 2).

### 1.3 — Secrets to add as we hit each feature (don't need them all today)

| Feature | Needs |
|---|---|
| Compile LaTeX resume (Step 2) | nothing extra — Tectonic is built into the worker image |
| Scrape LinkedIn/Indeed/Glassdoor (Step 3) | `APIFY_TOKEN` |
| Scrape free boards (RemoteOK, Arbeitnow, WeWorkRemotely) | nothing — they're public |
| AI resume tailoring (Step 3-4) | `OPENAI_API_KEY` + `DEEPSEEK_API_KEY` |
| Captcha solving on apply (Step 7-8) | `CAPTCHA_PROVIDER` + `CAPTCHA_API_KEY` |
| Avoid IP bans on LinkedIn/Workday | `PROXY_HOST/PORT/USER/PASS` |
| Read OTP emails (Step 5) | Gmail OAuth trio |
| Apply form defaults | `APPLY_EMAIL`, `APPLY_PASSWORD`, `APPLY_DEFAULT_PHONE` |

### 1.4 — Build & start

```bash
docker compose up -d --build
docker compose logs -f worker
```

You should see `heartbeat ok` lines every ~30s.

### 1.5 — Verify from the Lovable UI

1. Open the app → **Worker** page → should now show "online" with a recent heartbeat.
2. Open **Profile** → the "Compiling…" pane should no longer hang (it'll error gracefully until we upload a template in Step 2, which is expected).

---

### What I'll do for you in build mode

1. Read your user UUID from the DB and paste it into this step's instructions.
2. Show you the exact value of `SUPABASE_SERVICE_ROLE_KEY` to copy into `.env` (it's already a project secret).
3. Hand you the **3-line `.env`** to start with.
4. Stand by to debug the first `docker compose up` output.

---

### After Step 1 is green (worker shows online)

We move to **Step 2 — upload your LaTeX resume template**. Then 3 → 8 in order, one at a time, exactly as in the roadmap above.

Approve this and switch to build mode and I'll fetch your user UUID + service key so you can fill `.env` and launch the container.
