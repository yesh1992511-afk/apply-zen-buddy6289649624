# Plan: Enterprise-Hardening Pass, Then Resume Phases 3–8

Before moving to the Python worker, I'll do a focused "MNC-grade" hardening pass on what's already built (auth + frontend + DB). Then we continue the original roadmap.

---

## Part A — Hardening Pass on Phase 1 + 2 (single short phase, ~1 build turn)

Goal: production-quality foundation. No new features — only quality, security, UX, and reliability.

### A1. Security & Auth
- Run `supabase--linter` + `security--run_security_scan`; fix every finding.
- Enforce **leaked password protection (HIBP)** via `configure_auth`.
- Confirm `block_extra_signups` trigger works (test with a 2nd signup attempt → must fail).
- Verify RLS on **all 15 tables** with a probe query as anon and as a 2nd fake user (should return 0 rows).
- Add `/reset-password` route + "Forgot password?" link on `/login` (currently missing).
- Add Google OAuth button on `/login` (per defaults) + call `configure_social_auth` for google. Skip if you prefer email-only — confirm in question below.
- Server-side: confirm `attachSupabaseAuth` is registered in `src/start.ts` and `requireSupabaseAuth` is used wherever a server fn needs the user.

### A2. Data integrity
- Add missing **DB constraints + indexes**:
  - `jobs(dedupe_hash)` UNIQUE per user; index on `(user_id, posted_at desc)`, `(user_id, status)`.
  - `applications(user_id, job_id)` UNIQUE (prevent double-apply).
  - `sources(user_id, key)` UNIQUE.
  - `filters` partial unique: only one `is_default=true` per user.
  - FK references to `auth.users(id) ON DELETE CASCADE` on every `user_id` column (currently plain uuid).
- Add `updated_at` triggers wherever the column exists but trigger is missing.
- Add CHECK-style **validation triggers** on `automation_settings` (aggressiveness 1–5, parallelism 1–10, daily_start < daily_end when not 24/7).

### A3. Frontend quality
- Global **error boundaries** + `notFoundComponent` on every route with a loader (TanStack requirement we partially skipped).
- Loading skeletons on Dashboard / Jobs / Applications instead of spinners.
- Empty states with CTAs (e.g. Jobs empty → "Configure a Source").
- Toast feedback on every mutation (sources save, filters save, profile save, .tex upload).
- Form validation with `zod` + `react-hook-form` on Profile, Filters, Automation, Sources.
- Accessibility: labels on every input, focus rings, keyboard nav on Kanban.
- Mobile responsiveness pass on sidebar + tables.
- Dark/light theme tokens audit in `src/styles.css` (semantic only, no raw colors in components).

### A4. Observability
- Server-side log helper that writes to `logs` table (currently table exists but no writer).
- Worker heartbeat staleness banner on Dashboard (>3 min = red).
- Sentry-style global error logger on the client (writes to `logs` table via a server fn).

### A5. SEO + meta (login page only, since rest is auth-gated)
- `<title>`, meta description, favicon, canonical on `/login`.
- Robots: `noindex` for `_authenticated/*`.

**Deliverable:** clean linter, clean security scan, all forms validated, all routes have error boundaries, all writes have toasts, RLS proven, FKs + uniques in place.

---

## Part B — Resume Original Roadmap

### Phase 3 — Python VPS Worker Skeleton
Docker + APScheduler + Supabase Python client + adapter framework + deploy script.
**Blocker:** I need the VPS SSH access + Apify/OpenAI/DeepSeek/Captcha/Proxy credentials.

### Phase 4 — Dashboard + Jobs Feed + Kanban polish
Real KPIs from DB, bulk-apply flow wired end-to-end.

### Phase 5 — Resume/Cover-letter AI + LaTeX → PDF
DeepSeek reasoning → OpenAI content → tectonic compile → Storage.
**Blocker:** your `.tex` file uploaded via Profile page.

### Phase 6 — Apply engine + Gmail OTP
Per-portal Playwright adapters, stealth, proxy rotation, captcha hook, Gmail OAuth OTP loop, account creation.

### Phase 7 — Anti-detection longevity
Identity pool, IP hygiene, behavior diversity, cadence smoothing, health monitor.

### Phase 8 — Polish
Log viewer UI, daily digest email, retry/manual mark, export/backup, secrets rotation UI.

---

## What I need from you to start Part A immediately

1. **Google sign-in on login page?** (Yes / No — Lovable default is Yes)
2. **Confirm I should add `ON DELETE CASCADE` FKs to `auth.users`** on every `user_id` column. This will permanently delete all your data if your auth user is ever deleted. (Recommended yes.)
3. After Part A is green, do you want me to **pause for your VPS credentials** before Phase 3, or build Phase 4 (dashboard polish) first while you set up the VPS?

Once you answer, I'll switch to build mode and execute Part A in one pass, then continue.
