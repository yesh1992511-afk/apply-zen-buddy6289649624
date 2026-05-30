# Get ApplyZen Working for You — Step by Step

You're the only user (owner mode, not public yet). We'll go one step at a time. After each step you tell me "done" or "issue", and we move to the next.

---

## Step 1 — Resume ready (you're here)
Goal: have at least one resume saved + a PDF preview you can see.

Two options because the LaTeX compile worker is offline:
- **A. Remove the worker dependency** (recommended for solo use) → compile the resume PDF directly in the app, no background worker needed. Simpler, always works.
- **B. Keep LaTeX worker** → we set up/run the external worker service. More moving parts.

→ Pick A or B before we move on.

---

## Step 2 — Gmail setup (for sending applications + notifications)
Goal: app can send emails as you.

Sub-steps:
1. Enable 2FA on your Google account
2. Create a Gmail App Password (16 chars)
3. Paste into Profile → Gmail credentials (email + app password)
4. App verifies IMAP + SMTP connection → green check

---

## Step 3 — Job sources (where to scrape from)
Goal: at least 1 source enabled and pulling jobs.

- Pick from: LinkedIn, Indeed, Wellfound, RemoteOK, etc.
- Add session cookies via the browser extension (so scraping works while logged in)
- Run a manual scrape, confirm jobs land in DB

---

## Step 4 — Filters (what counts as a match)
Goal: one active filter that produces sensible matches.

- Create filter: keywords, location, remote/hybrid, salary min, exclude list
- Run match against existing jobs → review score + matched count
- Set as active filter in automation settings

---

## Step 5 — Notifications
Goal: you get an email when something matters.

- Set recipient email
- Toggle: high-score job, apply failed, worker offline, daily summary
- Send a test notification

---

## Step 6 — Dry-run apply (single job, manual)
Goal: end-to-end apply on ONE matched job, with you watching.

- Pick a matched job
- Click "Apply" → app generates tailored resume/cover letter
- Review the generated PDF + cover letter BEFORE submit
- Submit, capture screenshots, log result

---

## Step 7 — Automation tuning
Goal: enable auto-apply with safe limits.

- Set: max applies/day (start low, e.g. 5), parallelism = 1, aggressiveness = 2
- Schedule window (e.g. 9am–6pm your timezone, not 24/7 at first)
- Enable automation toggle
- Watch first day's runs in the dashboard

---

## Step 8 — Daily ops
Goal: it just runs.

- Review Applications tab each morning
- Mark interviews/responses as they come in
- Adjust filters weekly based on quality

---

## Two quick decisions for me to start

1. **Worker question (Step 1)**: Option A (remove worker, compile in-app) or Option B (set up the LaTeX worker)?
2. **Where are you currently stuck right now** — is the PDF preview still spinning, or is that resolved and you want to move to Gmail?

Once you answer those two, I'll execute Step 1 fully, then we proceed to Step 2.
