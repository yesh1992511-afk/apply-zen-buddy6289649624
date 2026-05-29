
## Security note (read first)

You pasted live credentials in chat. Chat history is retained. **Rotate these after we finish wiring** (especially OpenAI, DeepSeek, Apify, Capsolver, and the VPS root password — SSH should move to key-only). I will store them as Lovable Cloud secrets (encrypted, not in code) and write them to the VPS `.env` over SSH; nothing secret will be committed to the repo.

## What I will do

### 1. Store secrets in Lovable Cloud (runtime, encrypted)
Add via `secrets--add_secret` so server functions can read them:
- `APIFY_TOKEN`, `OPENAI_API_KEY`, `DEEPSEEK_API_KEY`
- `CAPTCHA_PROVIDER=capsolver`, `CAPTCHA_API_KEY`
- `PROXY_HOST=gate.decodo.com`, `PROXY_PORT=10001`, `PROXY_USER=spmxyvajnx`, `PROXY_PASS=qmDZk+ql8dJJ9uo54f`
- `VPS_HOST=147.93.47.24`, `VPS_USER=root`, `VPS_PASSWORD` (only used by a one-time deploy server fn, then you rotate)

Gmail OAuth (3 vars) is deferred — only needed for portals that email OTPs (LinkedIn, Workday). I'll add a `/setup` flow that walks you through it when you're ready.

### 2. Update the worker for your actual Apify actors
You picked different actors than the defaults. I will:
- Replace `bebity/linkedin-jobs-scraper` → `curious_coder/linkedin-jobs-scraper` in `worker/app/sources/apify_linkedin.py`
- Add `worker/app/sources/apify_ziprecruiter.py` (`crawlerbros/ziprecruiter-scraper-pro`)
- Add `worker/app/sources/apify_google_jobs.py` (`khadinakbar/google-jobs-scraper`)
- Register all three in `worker/app/sources/registry.py`
- Seed the `sources` table with these 3 + free sources (RemoteOK, WWR, Arbeitnow) on first run

### 3. Switch proxy config to Decodo
- Update `worker/.env.example` defaults to `gate.decodo.com:10001`
- Decodo is residential rotating — no code changes needed beyond host/user/pass

### 4. Finish the missing portal adapters
Currently stubs: `lever.py`, `workday.py`, `indeed.py`. I will implement:
- **Lever** (`jobs.lever.co/*`) — full form fill, resume upload, cover letter, submit
- **Indeed Easy Apply** — auth flow + 1-click apply with resume
- **Workday** — multi-step wizard (long, fragile; will mark `experimental`)

### 5. Anti-detection hardening (your other question)
Beyond proxies, the worker already has stealth — I will add:
- **UA rotation**: pool of 20 realistic Chrome/Edge UAs matched to fingerprint
- **Persistent browser profiles per portal** (`/data/profiles/<portal>/`) so cookies/cache survive restarts and look like a returning user
- **Per-portal rate limiter** with token bucket (LinkedIn: 30/hr, Indeed: 60/hr, Greenhouse: 120/hr)
- **Circuit breaker**: 3 challenges in 10min → pause that portal 2hr
- **Human-like delays**: Gaussian distribution on clicks/typing (already in `humanize.py`, will tune)
- **Daily cap per portal** read from `automation_settings.max_applies_per_day`

### 6. VPS deployment
Add a server function `deployWorker` that the `/setup` page calls:
- SSH to 147.93.47.24 (using stored VPS password)
- Install Docker if missing
- `git clone` the worker bundle (or `scp` it)
- Write `.env` from the stored secrets
- `docker compose up -d --build`
- Stream logs back to the UI

Plus a "Worker Status" card on `/setup` that reads `worker_heartbeat` to show green/red.

### 7. Frontend polish (MNC-level you asked for)
- **Dashboard**: replace placeholder with real KPIs (applies today, success rate, queue depth, last 24h funnel chart)
- **Jobs page**: virtualized list, skeleton loaders, filter chips
- **Applications page**: timeline view with screenshot lightbox, retry button
- **Logs page**: live tail via Supabase realtime, level filter, search
- **Profile page**: full CRUD for experiences/educations/skills/projects with drag-reorder
- **Sources page**: enable/disable toggle per source, cadence slider, last-run status
- **Filters page**: visual builder with live job count preview
- **Automation page**: aggressiveness slider 1-5 with explanation, daily window picker

### 8. Gmail OAuth deferred flow
On `/setup` add a "Connect Gmail" button that runs the OAuth dance and saves the 3 vars as secrets — no manual `docker run` needed.

## Order of execution
1. Store secrets → 2. Update worker code (Apify actors + proxy + portals) → 3. Deploy to VPS → 4. Verify heartbeat in UI → 5. Frontend polish → 6. Test end-to-end with 1 source enabled

## What I need from you to start
Nothing. I have everything. Once you approve this plan I'll implement straight through.

## After we're done — rotate these
OpenAI, DeepSeek, Apify, Capsolver keys, Decodo password, VPS root password (and switch to SSH keys). Takes ~5 min in each provider's dashboard.
