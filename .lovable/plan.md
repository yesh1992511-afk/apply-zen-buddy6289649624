# JobPilot — End-to-End Testing Playbook

Status check: the platform is feature-complete on paper (web app, extension, FastAPI worker, Supabase schema, admin console, billing, onboarding, audit/observability). It is **not yet validated end-to-end**. Below is the exact order to test, starting from zero (no signup, no SSH).

---

## Phase 0 — Pre-flight (5 min)

1. Open the **Published URL** (not the preview), not `/login` preview:
   `https://apply-zen-buddy6289649624.lovable.app`
2. Confirm **Lovable Cloud** is `ACTIVE_HEALTHY` (I can check with `cloud_status` on demand).
3. Confirm the published deploy is the latest build (banner / build hash in footer if present).

---

## Phase 1 — Auth & Onboarding (web only, 10 min)

1. **Sign up** as the single owner (email + password). Since `block_extra_signups` enforces 1 user, this is your only chance — pick the real email you want.
2. Verify email if a confirmation was sent.
3. Land on `/onboarding` → walk through all 7 steps:
   profile basics → extension pairing token → Gmail app-password → worker bootstrap script → pick a filter → add 1 source → dry-run.
4. Confirm sidebar **profile completeness meter** moves to 100%.
5. Visit `/billing` → confirm 14-day Pro trial seeded.
6. Visit `/privacy` → click "Export my data" (should return a JSON zip). Don't click delete.

✅ Gate: you can log in, profile saved, trial active, data export works.

---

## Phase 2 — Extension pairing & capture (15 min)

1. Load `extension/` as unpacked in Chrome (`chrome://extensions` → Developer mode → Load unpacked).
2. Open extension Options → paste the pairing token from `/extension` page → save.
3. Set a **cookie passphrase** (you'll need the same one on the VPS later — write it down).
4. Browse to a LinkedIn job listing while logged in → extension should auto-capture.
5. Popup should show: pending=0 after sync, captures-today > 0, worker dot = offline (no VPS yet — expected).
6. In web app `/jobs` → captured job appears within ~10s (realtime).

✅ Gate: extension captures and Supabase receives the job.

---

## Phase 3 — VPS worker bootstrap (30 min)

1. Provision a fresh Ubuntu 22.04 VPS (any 2 vCPU / 4 GB box: Hetzner, DO, Vultr).
2. SSH in as root, then run the **one-line bootstrap** copied from `/setup` page in the web app. It installs Docker, clones the worker, writes `.env` from your tokens.
3. Edit `worker/.env` and add:
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (from `/setup`)
   - `USER_ID` (your auth uid, shown on `/setup`)
   - `COOKIE_PASSPHRASE` (same as extension)
   - `LOVABLE_API_KEY` (already configured in cloud, copy from `/setup`)
   - optional: `APIFY_TOKEN`, `2CAPTCHA_KEY`, proxy creds
4. `make up` → `make logs` → confirm heartbeat lines every ~30s.
5. Web `/worker` page → green dot, version visible, last_seen < 1 min.
6. Extension popup → worker dot turns green.

✅ Gate: worker heartbeats, web + extension both see it online.

---

## Phase 4 — Source scraping (20 min)

1. `/sources` → enable **1 free source first** (e.g. `remoteok` or `arbeitnow` — no API key needed).
2. `make scrape remoteok` on VPS, watch logs.
3. `/jobs` → new rows appear, `score` populated, filter matching works.
4. Then enable 1 Apify source (LinkedIn) if you have an Apify token. Confirm scrape.
5. Test cookie-based scraping: extension `/extension` → "Sync LinkedIn cookies" → on VPS run `python -m app.cli scrape apify:linkedin` and confirm logged-in scraping works (no login wall).

✅ Gate: jobs flowing, scored, deduped.

---

## Phase 5 — Apply pipeline (the critical path, 30 min)

1. Make sure your **resume** is uploaded under `/profile` (LaTeX template + markers), **cover letter tone** set.
2. `/automation` → set max_applies_per_day=2, aggressiveness=1 (low, for testing).
3. Pick one matched job in `/jobs` → click **"Queue apply"** manually (don't enable autopilot yet).
4. On VPS: `make apply 1` → watch:
   - phase progression in `/applications` Kanban: `discovered → scored → tailored → queued → applying → submitted` (or `needs_review`)
   - screenshots appear in the application detail page timeline
   - `application_events` rows in DB
5. Verify the actual portal received the submission (check email confirmation from the portal).
6. Repeat for each portal you care about (Greenhouse, Lever, Ashby — these are most reliable; Workday/LinkedIn are flakier).

✅ Gate: at least 1 real application submitted end-to-end with screenshot proof.

---

## Phase 6 — Autopilot loop (1 hour observation)

1. `/automation` → flip **enabled = true**.
2. Watch `/dashboard` live activity panel for 30–60 min.
3. Confirm: scrape → score → queue → apply happens without manual intervention.
4. Trigger a failure (e.g. block a portal in firewall) → confirm:
   - error_events row appears in `/admin/observability`
   - retry with exponential backoff (`next_retry_at` populated)
   - notification email sent (if `notify_apply_failed` on)

✅ Gate: hands-off autopilot for 1 hour, errors handled gracefully.

---

## Phase 7 — Admin / observability / billing (15 min)

1. `/admin/system` → worker fleet view, queue counts, kill-switch works.
2. `/admin/observability` → resolve a test error, confirm it disappears.
3. `/admin/audit` → see every mutation you did during testing; export CSV.
4. `/admin/flags` → toggle a feature flag, confirm it's read on next page load.
5. `/billing` → simulate end-of-trial (or wait), confirm usage bars match `/admin/system`.

✅ Gate: admin console reflects reality.

---

## Phase 8 — Notifications & daily summary (next morning)

1. Wait until your configured `daily_summary_time` → confirm summary email received.
2. Kill the worker (`make down`) for >5 min → confirm offline alert email.

---

## What to do when something fails

| Symptom | First check |
|---|---|
| Web blank screen | I run `cloud_status` + dev-server logs |
| Extension not capturing | DevTools console on the captured page, then extension service-worker logs |
| Worker can't connect to DB | `worker/.env` SUPABASE_* values, then `make logs` |
| Apply stuck in `applying` | Application detail page → screenshot timeline → last DOM snapshot |
| 401 on `/api/public/sources/*` | Pairing token wrong/expired — regenerate from `/extension` |

Ping me at any failed gate with the symptom + which phase — I'll diagnose with logs and DB queries before changing code.

---

## What I am NOT claiming is done

- **Real portal coverage**: Greenhouse / Lever / Ashby / Workable are well-tested patterns; LinkedIn EasyApply, Workday, Indeed are best-effort and will need per-tenant tweaks once you hit real jobs.
- **Stripe live mode**: billing tables + UI exist; Stripe webhook is wired for test mode. Live keys + production webhook still need to be set when you're ready to charge.
- **2FA / TOTP UI**: backend ready, the enrollment screen is in `/privacy` but not battle-tested.
- **Multi-portal CAPTCHA solving**: 2captcha is wired but you'll burn credits on hard ones.

Everything else (schema, RLS, audit, RBAC, admin, onboarding, observability, retry/DLQ, idempotency, extension↔web↔worker sync) is implemented and ready for the Phase 1→8 walkthrough above.