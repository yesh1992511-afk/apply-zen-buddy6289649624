# JobPilot Worker

Python worker that runs on **your VPS** (not on Lovable). It scrapes job sources, tailors your resume with AI, compiles LaTeX → PDF, and applies to jobs via Playwright. Talks to the same Lovable Cloud (Supabase) database as the frontend.

## What it does

```
                +-----------------------------+
                |  Lovable frontend (UI)      |
                |  - profile, sources, filters|
                |  - jobs feed, applications  |
                +--------------+--------------+
                               | reads/writes
                               v
+--------------+      +-----------------+      +------------------+
| Apify / REST | ---> |  Supabase DB    | <--- |  Python Worker   |
| job sources  |      |  (RLS-scoped)   |      |  on your VPS     |
+--------------+      +-----------------+      +--------+---------+
                                                        |
                          +-----------------------------+
                          |
                  +-------v---------+  +----------+  +-----------+
                  | OpenAI/DeepSeek |  | tectonic |  | Playwright|
                  | resume tailoring|  | LaTeX→PDF|  | apply bot |
                  +-----------------+  +----------+  +-----------+
```

## One-time VPS setup

Tested on Ubuntu 22.04 / 24.04. Hetzner CX22 (~€4/mo) is plenty.

```bash
# 1) Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER && newgrp docker

# 2) Clone this repo to the VPS
git clone <your-repo-url> jobpilot && cd jobpilot/worker

# 3) Configure environment (see SECRETS.md for where to get each key)
cp .env.example .env
nano .env   # fill in every value

# 4) Build & start
docker compose up -d --build

# 5) Tail logs
docker compose logs -f worker
```

## Where to get every secret

See **[SECRETS.md](./SECRETS.md)** — step-by-step instructions for each provider.

## Architecture

```
app/
  main.py            APScheduler entrypoint + heartbeat loop
  config.py          env loading
  db.py              Supabase service-role client
  logger.py          writes structured logs to the `logs` table
  heartbeat.py       posts to `worker_heartbeat` every 30s

  sources/           job source adapters (Apify + free APIs)
    base.py
    registry.py
    apify_linkedin.py
    apify_indeed.py
    remoteok.py
    weworkremotely.py
    arbeitnow.py

  pipeline/          scrape → normalize → dedupe → filter → score
    normalize.py
    dedupe.py
    filter_engine.py
    scorer.py

  ai/                LLM gateway (OpenAI-compat for OpenAI + DeepSeek)
    gateway.py
    reasoner.py      DeepSeek-reasoner: analyzes JD vs profile
    tailor.py        OpenAI: returns LaTeX replacement blocks
    cover_letter.py

  latex/             LaTeX → PDF via tectonic
    markers.py       % LOV: marker engine (safe content swap)
    compile.py

  apply/             Playwright + stealth apply engine
    runner.py        polls `applications` queue, dispatches
    browser.py       Playwright launch + stealth + fingerprint pool
    proxy.py         residential proxy rotation
    captcha.py       2Captcha / CapSolver hook
    gmail_otp.py     Gmail OAuth → reads OTP/verification codes
    humanize.py      human-like delays + typing
    portals/
      base.py
      registry.py
      linkedin.py    LinkedIn Easy Apply
      greenhouse.py  Greenhouse ATS (boards.greenhouse.io/*)
      lever.py       Lever (jobs.lever.co/*)         [stub]
      workday.py     Workday (myworkdayjobs.com/*)   [stub]
      indeed.py      Indeed Easy Apply               [stub]
```

## Operating notes

- **Idempotency**: jobs use `dedupe_hash` (unique per user), applications use `(user_id, job_id)` unique. Re-running is safe.
- **Scheduling**: APScheduler runs sources per their `cadence_minutes` and the apply loop continuously. Honors `automation_settings.run_24_7` and `daily_start/end`.
- **Aggressiveness 1–5** is read from `automation_settings.aggressiveness` and scales delays / parallelism / daily cap.
- **Failure handling**: each application gets 3 attempts. After that → `failed` with `last_error`. Screenshots stored in the `screenshots` bucket.
- **Anti-detection**: fingerprint rotation (3–5 identities per portal), residential proxies, randomized cadence, mouse/keystroke jitter, captcha solver hook, behavior diversity.

## Maintenance

```bash
docker compose pull && docker compose up -d --build    # update
docker compose logs -f worker                          # tail
docker compose exec worker python -m app.cli scrape    # manual scrape
docker compose exec worker python -m app.cli apply 5   # process 5 queued
```

## Auto-deploy from GitHub (CI/CD)

A GitHub Action (`.github/workflows/deploy-worker.yml`) auto-deploys this worker to your VPS on every push to `main` that touches `worker/**`. You can also trigger it manually from the **Actions** tab → *Deploy worker to VPS* → *Run workflow*.

### One-time setup (5 min)

1. **On the VPS**, create a deploy key and authorize it:
   ```bash
   ssh-keygen -t ed25519 -f ~/.ssh/jobpilot_deploy -N ""
   cat ~/.ssh/jobpilot_deploy.pub >> ~/.ssh/authorized_keys
   cat ~/.ssh/jobpilot_deploy        # copy the whole private key
   ```

2. **In GitHub** → *Settings → Secrets and variables → Actions* → *New repository secret*:
   - `VPS_HOST` — your VPS hostname or IP (e.g. `srv706334.hstgr.cloud`)
   - `VPS_SSH_KEY` — the full private key from step 1 (`-----BEGIN…-----END-----`)
   - `VPS_USER` *(optional, defaults to `root`)*

3. Make sure the repo is already cloned at `/root/jobpilot` on the VPS and `worker/.env` is filled in.

That's it. Next push to `main` deploys automatically. The workflow runs `worker/deploy.sh` on the VPS, which `git pull`s, rebuilds the Docker image, restarts the container, and fails loudly if it doesn't come up healthy.
