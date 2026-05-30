# Plan — Browser-Extension Capture (Safe Mode)

## Goal

Reach ~95–98% job coverage including LinkedIn, Indeed, Glassdoor, ZipRecruiter, Wellfound, Dice — **without** account bans, proxies, or extra server costs.

## Approach

A Chrome/Edge extension runs inside **your** logged-in browser. When you visit any supported job board, it silently reads the jobs you're already viewing and POSTs them to the existing `/api/public/sources/ingest-extension` endpoint. They flow into the same dashboard, scoring, and apply pipeline you already have.

**Why this is safe:** the requests come from your real browser, your real IP, your real session cookies, with normal human timing (you scroll, it captures). To LinkedIn it looks identical to you browsing — because it is.

```text
[Your Chrome] --you browse--> linkedin.com/jobs
      |
      | extension reads visible job cards
      v
[Lovable Cloud] --ingest-extension--> jobs table --> dashboard --> apply worker
```

## What gets built

### 1. Extension package (`extension/` folder, downloadable ZIP)

- `manifest.json` (MV3) — permissions for the 6 portal domains only
- `content-linkedin.js` — parses `/jobs/search` and `/jobs/view/:id` pages
- `content-indeed.js` — parses Indeed result lists + job detail panes
- `content-glassdoor.js` — parses Glassdoor job listings
- `content-ziprecruiter.js` — parses ZipRecruiter cards
- `content-wellfound.js` — parses Wellfound (AngelList) listings
- `content-dice.js` — parses Dice search results
- `background.js` — batches captures (max 1 POST every 10s) and forwards to backend
- `popup.html` — shows: paired account email, today's capture count, on/off toggle, pause button
- `options.html` — paste pairing code from app → stores user token in `chrome.storage.local`

**Safety guardrails built in:**
- **No automated navigation, scrolling, or clicking** — extension only reads what you naturally view
- **Per-domain throttle:** max 1 outbound POST every 10s, capture buffer flushed in batches
- **Random 200–800ms jitter** on every read so it doesn't look mechanical
- **Domain allowlist** — extension cannot touch any site outside the 6 portals
- **Read-only** — never fills forms, never submits applications, never clicks "Apply" for you
- **Off switch** in popup, kill-switch on backend if a portal changes their TOS

### 2. Backend (extends existing pipeline)

- New route `src/routes/api/public/sources/ingest-extension.ts` — validates Bearer token, dedupes by `(source, external_id)`, inserts into existing `jobs` table, triggers `match_job_to_filters`
- New table `extension_tokens` (user_id, token, label, last_seen_at, captures_today) — RLS scoped to owner, token is the pairing secret
- Daily counter resets via a tiny pg_cron entry

### 3. UI additions (existing app)

- New page `/extension` — "Pair your browser" with copy-able token, install instructions, live capture feed, per-portal counts (last 24h), revoke button
- Download button → fetches `/extension.zip` from `public/`
- Sources page gets 6 new rows (LinkedIn, Indeed, Glassdoor, ZipRecruiter, Wellfound, Dice) showing `via extension` badge + last-seen timestamp

## Coverage after this ships

| Source | Before | After |
|---|---|---|
| Greenhouse/Lever/Ashby/Workable/SmartRecruiter | ✅ | ✅ |
| RemoteOK/Remotive/Arbeitnow/Himalayas/Adzuna/Jooble | ✅ | ✅ |
| LinkedIn | ❌ | ✅ via extension |
| Indeed | ❌ | ✅ via extension |
| Glassdoor | ❌ | ✅ via extension |
| ZipRecruiter | ❌ | ✅ via extension |
| Wellfound | ❌ | ✅ via extension |
| Dice | ❌ | ✅ via extension |
| **Total realistic coverage** | **~80%** | **~97%** |

## Honest trade-offs

- Only captures while your browser is open and you're on those sites. Open LinkedIn once a day, scroll the feed — that's enough to keep it fed.
- First-time setup = unzip + load unpacked extension in `chrome://extensions` (4 clicks). Not one-click; Chrome Web Store publishing is a separate later step.
- If a portal redesigns their HTML, that one parser breaks until updated. Other 5 keep working.
- No "auto-apply" on these 6 portals — that's where bans happen. The existing ATS auto-apply (Greenhouse/Lever/etc.) is unaffected.

## Out of scope

- Storing your portal passwords on the server
- Residential proxies, headless browsers, captcha solvers
- Auto-clicking "Easy Apply" on LinkedIn (high ban risk — kept manual; extension surfaces the job, you click apply yourself in the same tab)
- Chrome Web Store publication (can be a follow-up)

## Order of work

1. Backend route + `extension_tokens` table + migration (15 min)
2. `/extension` pairing page in app (20 min)
3. Extension skeleton + manifest + background batcher (20 min)
4. 6 content scripts, one per portal (45 min)
5. Package to `public/extension.zip` + download button (10 min)
6. Sources page — add 6 extension rows with last-seen indicator (10 min)

~2 hours end-to-end. Approve and I'll build it.
