# JobPilot — How the backend works (plain English)

A one-page map of every section, what it talks to, and how data flows.
Use this any time you wonder "what does this button actually do?"

---

## 1. The big picture (data flow)

```
  YOU                              YOUR BACKEND (Lovable Cloud)            YOUR WORKER (local/VPS)
  ───                              ───────────────────────────             ──────────────────────
  Browser extension  ──HTTPS──►  /api/public/sources/ingest-extension
                                          │
                                          ▼
                                     [jobs table]  ──► match_job_to_filters()
                                          │                 (scores each job 0-100)
                                          ▼
                                     [matched jobs]
                                          │
                                          ▼
                                     [applications: queued] ◄──── you click "Apply" in /jobs
                                          │
                                          ▼
                                     [worker_commands]  ◄────────────  worker polls every 10s
                                                                          │
                                                                          ▼
                                                                      runs Playwright,
                                                                      fills the form,
                                                                      uses your resume
                                                                          │
                                                                          ▼
                                     [application_events]  ◄── worker reports progress + screenshots
                                          │
                                          ▼
                                     [notification_log]  ──► email summary via your Gmail
                                          │
                                          ▼
                                     [audit_log] + [usage_events]  ──► /admin/observability
```

Plain-English version:
1. Jobs arrive in your database from one of three sources: the **browser extension** (scrapes pages you view), an **Apify scraper** (LinkedIn/Indeed in bulk), or a **REST source** (Greenhouse/Lever job boards).
2. As each job lands, a database function scores it against your filters and tags it `matched` or `discarded`.
3. You (or the automation) move a matched job into `applications` with status `queued`.
4. The worker picks it up, tailors your resume + cover letter via Lovable AI, fills the form in a real browser, and writes back progress + screenshots.
5. You get an email summary; everything is logged for auditing.

---

## 2. What each page does

| Section | URL | Tables read | Tables written | Server function |
|---|---|---|---|---|
| Dashboard | `/dashboard` | jobs, applications, automation_runs, worker_heartbeat | — | — (direct read) |
| Jobs | `/jobs` | jobs | applications (when you queue) | — |
| Applications | `/applications` | applications, application_events | applications (retry) | — |
| Application detail | `/applications/$id` | applications, application_events, storage/screenshots | — | — |
| Filters | `/filters` | filters | filters | — |
| Sources | `/sources` | sources | sources, worker_commands | `triggerScrape`, `triggerTestSource` |
| Automation | `/automation` | automation_settings, filters | automation_settings | — |
| Worker | `/worker` | worker_heartbeat, worker_commands | worker_commands | — |
| Logs | `/logs` | logs (realtime) | — | — |
| Notifications | `/notifications` | notification_settings, gmail_credentials, notification_log | notification_settings, gmail_credentials | `saveNotificationSettings`, `saveGmailCredentials`, `sendTestNotification` |
| Profile | `/profile` | profile, experiences, educations, skills, projects, certifications, languages, references_list | same | — |
| Onboarding | `/onboarding` | profile, extension_tokens, gmail_credentials, worker_heartbeat, filters, sources, applications | profile.onboarding_state | — |
| Billing | `/billing` | plans, subscriptions, usage_quotas, user_roles | — | `getBillingOverview` |
| Extension | `/extension` | extension_tokens | extension_tokens | — |
| Setup | `/setup` | worker_heartbeat, automation_settings, extension_tokens, gmail_credentials | — | — |
| Privacy | `/privacy` | account_deletion_requests | account_deletion_requests | `requestDataExport`, `requestAccountDeletion` |
| Admin → Observability | `/admin/observability` | error_events, automation_runs, worker_heartbeat | error_events (resolve) | — |
| Admin → System | `/admin/system` | worker_heartbeat, worker_commands, applications | worker_commands | `dispatchWorkerCommand` |
| Admin → Audit | `/admin/audit` | audit_log | — | — |
| Admin → Flags | `/admin/flags` | feature_flags | feature_flags | `listFeatureFlags`, `upsertFeatureFlag` |
| Admin → Plans | `/admin/plans` | plans | — | — |

---

## 3. External entry points (HTTP endpoints anyone can call)

These live under `/api/public/*` — that prefix bypasses Lovable's site auth so external callers (extension, cron, worker) can reach them. **Every one validates a bearer token or signed payload** before doing anything.

| Endpoint | Who calls it | What it does |
|---|---|---|
| `POST /api/public/sources/ingest-extension` | Chrome extension | Receives scraped jobs, dedupes, inserts into `jobs`, scores them, bumps `extension_tokens.captures_today` |
| `POST /api/public/sources/queue-apply` | Chrome extension | Queues an application from a job page the user is viewing |
| `POST /api/public/sources/upload-cookies` | Chrome extension | Encrypts and stores logged-in session cookies in `session_cookies` so the worker can skip login |
| `GET /api/public/sources/worker-status` | Chrome extension | Returns whether the worker is online, used for popup status |
| `POST /api/public/sources/run-tier` | Cron / scheduler | Runs all enabled sources of a given tier (every 15min / hourly / daily) |
| `POST /api/public/hooks/apply-worker` | Worker process | Worker reports back progress on an application |
| `POST /api/public/hooks/check-heartbeat` | Cron | Looks for workers that went silent, fires an alert |
| `POST /api/public/hooks/daily-summary` | Cron (20:00 user local) | Sends each user their daily summary email |
| `POST /api/public/extension/error-report` | Chrome extension | Captures uncaught errors from the extension into `error_events` |

---

## 4. The browser extension end-to-end

1. **Install** — Go to `/extension`, click **Download ZIP**. Unzip, then in Chrome → `chrome://extensions` → enable Developer mode → **Load unpacked** → pick the folder.
2. **Pair** — On the same page click **+ New token**. Copy the token. Open the extension's options page (`chrome://extensions` → JobPilot Capture → Details → Extension options) and paste it. The endpoint is pre-filled.
3. **Capture** — Browse LinkedIn/Indeed/Glassdoor/ZipRecruiter/Wellfound/Dice. The content script extracts every visible job and POSTs them to `/api/public/sources/ingest-extension` with `Authorization: Bearer <your-token>`.
4. **Verify** — Inside 5 seconds you'll see:
   - New rows in `/jobs` with `source_key = ext_linkedin` (etc.)
   - `/extension` page shows your token's `captures_today` increase
   - `/sources` shows a row like "LinkedIn (extension)" with last_run_status `succeeded`
5. **Apply** — From the extension popup, click **Queue apply** on any job page. That hits `/api/public/sources/queue-apply` which inserts into `applications` with status `queued`. The worker picks it up.
6. **Skip login** — If a job portal is blocking the worker with a login wall, you can click **Sync session** in the popup; the extension reads your cookies for that site, encrypts them with your token, and POSTs to `/api/public/sources/upload-cookies`. The worker re-uses them.

What the endpoint enforces (security):
- Bearer token must exist in `extension_tokens` and not be revoked.
- Body is validated by Zod: max 100 jobs per batch, every URL must be a valid URL, every text field has a max length.
- Jobs are deduped against your own `jobs` (per-user `dedupe_hash`) — sending the same job twice is a no-op.
- No PII is ever returned in the response.

---

## 5. The worker (your local/VPS process)

The worker is a separate Node.js process you run on your laptop or a $5 VPS. It:

1. Polls `worker_commands` for instructions every 10 s.
2. Polls `applications` where `status='queued'` and `user_id=you` every 10 s.
3. For each: opens Playwright, navigates to the job URL, fills the application, uploads your tailored resume, submits.
4. After each step, POSTs a progress event to `/api/public/hooks/apply-worker` which writes `application_events` and updates `applications.status`.
5. Every 30 s, POSTs a heartbeat that updates `worker_heartbeat.last_seen`.

If the worker stops calling for >5 min, the `check-heartbeat` cron fires and `/notifications` sends you an email if **Worker offline alerts** is on.

---

## 6. Security model (one paragraph)

Every table in the database has Row-Level Security (RLS) enabled with the rule `user_id = auth.uid()`. The frontend uses the publishable (anon) key, so even if someone steals it they can only see their own rows. Admin pages use server functions that check `has_role(auth.uid(), 'admin')` before doing anything. The extension uses per-token bearer auth (not your password) — you can revoke a token any time from `/extension`. Webhooks use bearer tokens or HMAC signatures. The service-role key only exists on the server.

---

## 7. Where data lives in storage

- **`resumes` bucket** — Your uploaded resumes (PDF + LaTeX). Private, only you can read.
- **`screenshots` bucket** — Worker screenshots of each application step. Private. Linked from `application_events.screenshot_path`.
