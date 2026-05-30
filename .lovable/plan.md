# Phase 6–9 Plan

You picked all four. I'll sequence them so each phase de-risks the next: prove the core loop works (6) → ship the missing piece users need to actually run it (7) → put a paywall around it (8) → publish and walk the live site (9).

---

## Phase 6 — End-to-end smoke test (no new features)

Goal: prove a fresh user can go sign-up → onboarding → add source → match a job → enqueue → worker callback → timeline updates, and fix what breaks.

1. **Reset path**: create a throwaway account via the live signup form (single-user gate may need a temporary toggle — confirm with you before flipping).
2. **Walk onboarding wizard**: fill minimum profile (name, work auth, 1 experience, default resume upload). Verify `profile.onboarded_at` gets set and redirect releases.
3. **Add 1 source** (LinkedIn or Indeed config), trigger manual run, verify `jobs` rows appear and `match_job_to_filters` populates `score` + `matched_filter_ids`.
4. **Trigger apply-worker hook** with valid `INTERNAL_HOOK_TOKEN`; verify `applications` row transitions phase, `application_events` populate, screenshot uploads land in `screenshots` bucket.
5. **Verify timeline UI** shows events, retry button works, error banner appears on forced failure.
6. **Check daily-summary + heartbeat hooks** by manual invocation and confirm `notification_log` entries.
7. **Fix anything broken inline** (expected: small env/wiring bugs, missing toasts, broken redirects). Out of scope: redesigns.

## Phase 7 — Browser extension polish

Goal: ship a working companion extension the worker can talk to.

1. **Audit** existing `extension/` (if any) and `extension_tokens` table usage.
2. **Auth handshake**: extension popup pastes a token from `/extension` page → stored in `chrome.storage.local` → all requests send `Authorization: Bearer <token>`.
3. **Session cookie capture**: when user is logged into LinkedIn/Indeed, extension reads cookies for whitelisted hosts and POSTs encrypted blob to a new `/api/public/extension/cookies` endpoint (signature verified via token → `session_cookies` row).
4. **Autofill ping**: when worker is running on an application page, content script reads field map from a new `/api/public/extension/profile` endpoint and fills inputs. Errors POST to `/api/public/extension/report`.
5. **Package**: `nix run nixpkgs#zip` → `public/extension.zip`; download via fetch+blob on `/extension` page; install instructions UI.
6. **Quotas**: increment `extension_tokens.captures_today`, reset on `last_reset_date` rollover.

## Phase 8 — Billing / paywall

Goal: gate usage behind a subscription using Lovable's built-in payments.

1. Run `recommend_payment_provider` → enable **Stripe payments** (default for SaaS subscriptions).
2. Seed `plans` table: Free (3 sources, 10/day), Pro ($29 — 10 sources, 100/day), Unlimited ($99 — unlimited + cookie_sync + admin_console). Migration only — no UI for editing plans.
3. **Checkout**: `/billing` page lists plans, "Upgrade" button calls a server fn that creates a Stripe checkout session.
4. **Webhook** at `/api/public/stripe/webhook` (signature verified) writes to `subscriptions` (status, plan_key, current_period_end).
5. **Enforcement** in server fns:
   - `applications.ts` enqueue: count today's applies vs `plan.max_applies_per_day`; reject with friendly error.
   - `sources.ts` create: count active sources vs `plan.max_sources`.
   - Hide cookie-sync and admin features behind plan boolean checks.
6. **UI**: sidebar badge shows current plan, usage meter on dashboard ("12 / 100 applies today"), upsell banner when near limit.
7. **Trial**: 7-day `trialing` status auto-assigned on signup via `handle_new_user`.

## Phase 9 — Publish & QA

1. Click Publish → wait for production URL.
2. Walk the live site through the same Phase 6 script as a real signup.
3. Verify SEO (title/desc on /, /login, /pricing), favicon, mobile viewport.
4. Hit each `/api/public/*` URL with curl using the stable `project--{id}.lovable.app` host to confirm cron-ready endpoints respond.
5. File leftover issues as a follow-up list rather than building more.

---

## Technical notes

- **Single-user gate** (`block_extra_signups`) blocks Phase 6's throwaway signup. Two options: (a) temporarily disable the trigger for the test, (b) reuse current account and reset `profile.onboarded_at = null` to re-walk onboarding. **I recommend (b)** — less risky.
- **Stripe BYOK vs built-in**: I'll use built-in (`enable_stripe_payments`) — no API keys needed, you fill a short form.
- **Extension** ships as an unpacked `.zip`; Chrome Web Store submission is out of scope.
- **No edge functions** — all new server logic stays in `createServerFn` + `/api/public/*` routes per stack rules.

## Out of scope

- Design overhaul, new auth providers, admin console UI, team/seat billing, mobile native app, i18n.

---

Reply **"go"** to execute phases 6 → 9 in order, or call out which to drop/reorder (e.g. "skip billing for now" or "extension first, smoke test after").