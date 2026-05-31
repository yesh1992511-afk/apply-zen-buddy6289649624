# Plan: Fix Gmail "Unverified" + "Send test email" not arriving

## Root cause

The Notifications page enqueues a `notify_test` row in `worker_commands` and depends on the Python worker to actually open the SMTP connection, send the mail, write `notification_log`, and stamp `gmail_credentials.verified_at`. Your worker is currently **stale** (badge visible top-right). With no worker consuming the queue:
- the test email is never sent,
- `last_error` never gets set,
- `verified_at` stays `NULL`,
- the badge stays red **Unverified**.

The fix is to stop routing this through the worker and do the SMTP send + verification directly from a TanStack server function. That's the only way the button can give the user an authoritative answer in one click.

## Changes

### 1. Add `nodemailer` (Worker-compatible)

Install `nodemailer` + `@types/nodemailer`. Cloudflare's `nodejs_compat` runtime supports `node:net` + `node:tls`, which is everything nodemailer needs for `smtp.gmail.com:465`. No other packages.

### 2. New server fn `verifyAndSendTestEmail` in `src/lib/notifications.functions.ts`

Replaces the current `sendTestNotification` behavior. Flow:

1. Load the user's `gmail_credentials` row (email + app_password).
2. Build a nodemailer transport: `host: smtp.gmail.com, port: 465, secure: true, auth: { user, pass }`.
3. `transporter.verify()` — proves the app password is valid against Gmail's SMTP without sending.
4. `transporter.sendMail({ from: user, to: recipient_email ?? user, subject: "JobPilot test email", text: "...", html: "..." })`.
5. On success:
   - `update gmail_credentials set verified_at = now(), last_error = null where user_id = ?`
   - `insert into notification_log(kind='test', subject, status='sent', recipient_email)`
   - return `{ ok: true, messageId }`.
6. On failure (any thrown error):
   - `update gmail_credentials set verified_at = null, last_error = <message>`
   - `insert into notification_log(kind='test', status='failed', last_error)`
   - throw with a human-readable message keyed off Gmail's typical SMTP errors:
     - `535-5.7.8` → "App password rejected. Make sure 2-Step Verification is on and you used a fresh 16-char App Password (no spaces)."
     - `534-5.7.9` → "Application-specific password required."
     - `EAUTH` → "Authentication failed — re-generate the App Password."
     - `EDNS` / `ECONNECTION` → "Couldn't reach smtp.gmail.com — try again."
     - fallback: raw error string.

Keep the existing `sendTestNotification` symbol as a thin alias forwarding to `verifyAndSendTestEmail` so other callers (worker, daily-summary) don't break.

### 3. Reuse the same transport for real notifications

Extract `getGmailTransport(userId)` and `sendUserEmail(userId, { subject, text, html, to? })` helpers in `src/lib/notifications.functions.ts`. Update `src/routes/api/public/hooks/daily-summary.ts` to use `sendUserEmail` directly instead of waiting on the worker — that path was also worker-dependent and silently dropping. (Worker-side cover-letter generation is untouched.)

### 4. UI tweaks in `src/routes/_authenticated/notifications.tsx`

- Switch the **Send test email** button to call `verifyAndSendTestEmail` synchronously; show a spinner, then either a green "Sent ✓" toast with the messageId or a red toast with the specific reason (from the keyed errors above).
- Auto-refetch the page query on success so the **Unverified** badge flips to **Verified** without a manual refresh.
- Add a small "Why is this still showing Unverified?" tooltip next to the badge explaining that verification = a successful SMTP test send.
- Surface `creds.last_error` more prominently when present (red panel with copy button, like /sources rows).

### 5. Trim/normalize input

`saveGmailCredentials` already strips whitespace. Also reject if length ≠ 16 after stripping (Gmail App Passwords are always 16). Show that as a field error before saving.

### 6. Worker badge clarification (cosmetic)

The "Worker stale" pill in the header currently makes users think this whole feature needs the worker. Add a small caption under it on hover: "Notifications send directly from the app — worker only handles applies + scraping."

## Out of scope

- Python worker code, the apply pipeline, scraping, Lovable Email infrastructure.
- Storing the App Password encrypted (already stored plaintext per existing schema; switching to Vault-encrypted secrets is a separate hardening pass).
- IMAP OTP reading (still worker-side; only SMTP sending is moved into the app).

## Verification steps after build

1. Reload `/notifications`, click **Send test email**.
2. Expect either:
   - green toast "Test email sent — check your inbox" + badge flips to **Verified** in <2s, OR
   - red toast with a specific actionable reason and `last_error` panel populated.
3. Inspect `notification_log` — should have exactly one new row per click.
4. The Gmail inbox `yeswanth.986ch@gmail.com` should receive the message within ~5 seconds.
