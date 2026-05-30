
# Enterprise-Grade Pass

This app already has solid bones (27 tables, extension, worker, realtime, heartbeat, command bus). It's missing the connective tissue and polish that distinguish "indie SaaS" from "MNC-grade tool." Note: the DB enforces single-user (`block_extra_signups`), so RBAC = internal admin/owner/viewer roles, not multi-tenant teams.

---

## 1. Observability & Audit (foundation — everything else depends on this)

**New tables**
- `audit_log` — actor, action, entity_type, entity_id, before/after JSON, ip, user_agent, ts. Append-only.
- `request_traces` — trace_id, span_id, parent, route, duration_ms, status, error. For end-to-end timeline.
- `error_events` — fingerprint, message, stack, route, count, first_seen, last_seen, resolved. Sentry-lite.

**Wiring**
- Server-fn middleware `withAudit({entity, action})` writes to `audit_log` on every mutation.
- Worker emits trace spans per pipeline stage (discover → score → tailor → apply → confirm).
- Extension errors POST to `/api/public/extension/error-report` with trace_id.

**UI**
- `/admin/observability` — error feed, slow-trace list, audit log table with filters (actor, action, date, entity).
- Per-application **timeline view** stitching logs + traces + worker events + screenshots.
- SLA panel: ingest→matched p50/p95, matched→applied p50/p95, worker uptime %.

---

## 2. Security & Compliance

**Auth hardening**
- Enable HIBP leaked-password check via `configure_auth`.
- 2FA (TOTP) via `supabase.auth.mfa` — enroll flow + challenge on sign-in.
- Active sessions panel (list devices, revoke).
- Re-auth gate on sensitive actions (cookie upload, secret rotation, data export).

**Secrets & cookies**
- Rotate extension token UI (already partially scaffolded — finish it).
- `session_cookies`: add `last_used_at`, `rotation_due_at`, age warning chip.
- Cookie passphrase strength meter; failed-decrypt counter triggers re-upload prompt.

**Data rights (GDPR-style)**
- `POST /api/public/account/export` → zip of all user data (jobs, apps, profile, logs).
- Soft-delete + 30-day purge for `account/delete`.
- `/settings/privacy` page with toggles + export/delete buttons.

**Linter sweep**
- Run `supabase--linter` and fix every finding before shipping.
- Audit RLS on all 27 tables for `auth.uid()` scoping consistency.

---

## 3. RBAC & Admin Console (single-user-aware)

**Roles** (already have `app_role` + `user_roles`)
- Extend enum: `owner`, `admin`, `viewer`. Owner = full, admin = ops without billing, viewer = read-only.
- `has_role()` already exists — wire it into route guards (`_admin.tsx` layout).

**`/admin` console** (new layout route)
- `/admin/system` — worker fleet, queue depth, kill-switch (writes `worker_commands` kind=`pause`).
- `/admin/users` — single-user, but shows role, last-login, MFA status, session count.
- `/admin/feature-flags` — new table `feature_flags(key, enabled, rollout_pct, payload)`.
- `/admin/audit` — read-only mirror of audit_log with export to CSV.

---

## 4. Billing & Plans (usage-metered)

- Enable Lovable's built-in Stripe payments (`enable_stripe_payments`).
- New tables: `plans`, `subscriptions`, `usage_quotas`, `invoices_cache`.
- Plans: Free (10 applies/day), Pro (100/day + cookie sync), Team (500/day + admin console).
- Quota guard middleware on apply path: read `automation_settings.max_applies_per_day` + plan cap, hard-stop at lower of the two with toast + upgrade prompt.
- `/billing` page: plan card, usage bars (applies, AI tokens, captures), invoice list, upgrade/cancel.
- Trial: 14-day Pro on signup.

---

## 5. Onboarding (guided)

New `/onboarding` flow route + checklist persisted on `profile.onboarding_state jsonb`.

Steps:
1. **Profile basics** (name, location, work auth) — required fields with completeness %.
2. **Connect extension** — show token, "Open Chrome Web Store" + manual install zip + live "Detected!" indicator via realtime.
3. **Connect Gmail** — IMAP/SMTP form, "Test send" button.
4. **Provision worker** — copy-paste install command for VPS + live heartbeat check.
5. **Pick filter preset** — 4 starter filters (SWE, PM, Designer, Data).
6. **First source** — enable LinkedIn or Indeed.
7. **Dry run** — kick a `test_apply` command, show result.

Profile-completeness meter (%) in sidebar until 100%.

---

## 6. Apply Pipeline Phases (formal state machine)

Today `applications.status` is a flat enum. Upgrade to phased pipeline:

```
discovered → scored → tailored → queued → applying → submitted
                                                   ↓
                                          needs_review / failed → retry
                                                   ↓
                                          follow_up_sent → replied
                                                   ↓
                                          interview → offer / rejected
```

**Schema**
- New `application_events(application_id, phase, status, payload, ts)` — full state-machine log.
- `applications.phase` column (USER-DEFINED enum).
- `applications.retry_count`, `applications.next_retry_at`, `applications.idempotency_key`.

**Worker**
- Idempotency: hash(user_id, job_url, day) — refuse duplicate submits.
- Dead-letter queue: 3 failures → `needs_review`, surface in dashboard.
- Exponential backoff between retries.

**UI**
- `/applications` becomes a Kanban with the 8 columns above, drag to override phase.
- Per-app stepper (already have `ApplyStepper.tsx`) shows full phase history with timestamps.
- Follow-up scheduler: auto-send polite ping after N days with no reply.

---

## 7. Professional UI Polish (MNC look)

**Design system tokens** (audit `src/styles.css`)
- Density modes: comfortable / compact (toggle in settings, persisted).
- Elevation scale (`--shadow-1..6`), motion tokens (`--ease-in-out-emphasized`, durations).
- Status colors mapped to semantic tokens: `--status-success/warning/error/info/queued/running`.

**Components**
- `DataTable`: column visibility, sort, multi-filter, saved views, CSV export, infinite scroll. Use for /jobs, /applications, /logs, /admin/audit.
- `GlobalSearch` (⌘K) — search jobs, apps, sources, logs, settings; already have `CommandPalette` — wire real results.
- `Breadcrumbs` in `PageHeader`.
- Standardize: empty states, error states, loading skeletons (already have skeletons.tsx — apply consistently).
- Toast policy: success quiet, error verbose with copy-stack button.

**Accessibility**
- WCAG AA pass: focus rings, ARIA labels, keyboard nav for Kanban & DataTable, `prefers-reduced-motion`.
- Dark mode parity audit.

**i18n scaffold**
- `react-i18next` set up with `en` locale; extract strings from sidebar, headers, errors. Don't translate yet, just wire it.

**Topbar**
- Global: env badge (Preview/Prod), worker dot, queue depth, notifications bell, ⌘K hint, user menu.

---

## 8. End-to-End Wiring Hardening

| Surface | Issue | Fix |
|---|---|---|
| Extension → backend | No idempotency on capture | URL+day hash dedup at API layer |
| Backend → worker | Toggle latency | Already realtime; add ack write-back so UI shows "worker acknowledged in 1.2s" |
| Worker → backend | Retries lost on restart | Persistent retry queue in `application_events`, worker reads on boot |
| Apply success | No screenshot proof timeline | Stream screenshots into `applications.screenshots` ordered with `application_events` |
| Cookies → worker | Silent decrypt failure | Already added log; add UI alert "Re-upload cookies for linkedin.com" |
| Gmail | No delivery confirmation | Worker polls inbox for the auto-reply, marks `application_events.phase=replied` |
| Notifications | One-shot only | Idempotency key on `notification_log` to prevent double-send on retry |
| All HTTP | No request_id | Inject `x-request-id` in middleware, log everywhere, surface in error toasts |

---

## Sequencing (build order)

1. **Audit + trace + error tables** (foundation — everything writes to these)
2. **Apply pipeline phases** schema migration (unblocks Kanban + retry/idempotency)
3. **Admin console + RBAC route guards**
4. **Security hardening** (MFA, HIBP, sessions, GDPR export)
5. **Billing + quotas**
6. **Onboarding flow**
7. **Professional UI polish + DataTable + ⌘K + topbar**
8. **Wiring fixes from §8 table**
9. **Linter sweep + a11y pass + verification**

## Technical notes

- All new tables follow the 4-step migration: CREATE → GRANT → ENABLE RLS → POLICY.
- `audit_log`, `error_events`, `application_events` get `REPLICA IDENTITY FULL` and join `supabase_realtime` so the new admin views are live.
- `withAudit` middleware sits next to `requireSupabaseAuth` so every mutating server-fn gets audited free.
- Kanban uses `@dnd-kit` (already in many TanStack apps; will `bun add` if missing).
- Stripe is the built-in Lovable integration, no BYOK.
- Single-user invariant preserved: signup still blocked; RBAC roles are assigned to the one user manually via admin console.

## Out of scope

- New scrapers / new job sites
- Visual redesign (we polish, we don't redesign)
- Mobile app
- Multi-tenant teams (DB blocks it)
- AI model swaps
