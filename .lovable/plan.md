# Portal Coverage Sprint → 92–95% US

Current: ~80% after Ashby. Target: 92–95%. Past that, ROI collapses (captcha-walled or OAuth-only).

## Tier 1 — Biggest gains, lowest effort (+10%)

These are all ATS-style JSON endpoints (no JS rendering, no proxy needed). Same pattern as Greenhouse/Lever/Ashby — drop-in.

| Portal | Scraper | Apply Adapter | Coverage gain | Effort |
|---|---|---|---|---|
| **SmartRecruiters** | `ats_smartrecruiters.py` (public posting API) | `smartrecruiters.py` (multi-step form, no login) | +4% | 45 min |
| **Workable** | `ats_workable.py` (`/spi/v3/accounts/{sub}/jobs`) | `workable.py` (apply API w/ resume upload) | +3% | 45 min |
| **Recruitee** | `ats_recruitee.py` (`{company}.recruitee.com/api/offers`) | `recruitee.py` | +2% | 30 min |
| **Teamtailor** | `ats_teamtailor.py` (jsonapi) | `teamtailor.py` | +1% | 30 min |

## Tier 2 — High-volume US tech boards (+5%)

Need light Playwright, no login. Conditional proxy = off.

| Portal | What | Coverage gain | Effort |
|---|---|---|---|
| **BuiltIn** | Scraper only (apply redirects to ATS — already covered by Tier 1) | +2% | 30 min |
| **Wellfound / AngelList** | Scraper via GraphQL; apply needs login → scrape-only first | +2% | 45 min |
| **YC Work At A Startup** | Scraper (`workatastartup.com/companies.json`); apply redirects | +1% | 20 min |

## Tier 3 — Niche but valuable (+2%)

| Portal | What | Effort |
|---|---|---|
| **USAJobs** | Scraper via official public API (key-free), apply is OAuth-walled → scrape-only | 30 min |
| **Dice** | Scraper (server-rendered HTML, needs Playwright + residential proxy) | 45 min |

## Skip list (intentional, low ROI)

- **Monster / CareerBuilder / SimplyHired** — aggregator overlap with Indeed, heavy bot defense, ~0.5% unique
- **ZipRecruiter** — login-walled for any useful filter, captcha-heavy
- **FAANG career sites** (Google/Meta/Amazon) — already in Workday/Greenhouse/Lever
- **Hired / Vettery** — recruiter-initiated, no scrape model

## Cross-cutting work (do once, benefits all adapters)

1. **Apply-adapter base class** in `worker/app/apply/portals/_base.py` — common: resume upload, OTP polling, screenshot capture, error taxonomy. Refactor Ashby/Greenhouse/Lever to extend it.
2. **Scraper base class** in `worker/app/sources/_base.py` — common: dedupe_hash, normalize salary, posted_at parsing, source attribution.
3. **Per-portal config** in DB (`portals` table: `slug, cadence_minutes, max_items, needs_proxy, needs_captcha, enabled`) — UI on Sources page to toggle/tune without code deploys.
4. **Registry auto-discovery** — drop a file in `sources/` or `apply/portals/` and it self-registers (replaces manual `registry.py` edits).

## Telemetry per new portal

Each scraper must emit `usage_events` rows: `provider=apify|self`, `units=results_count`, `cost_usd` (apify) or `0` (self-hosted). Each apply adapter logs to `logs` with `portal_slug`, `outcome`, `duration_ms`, `screenshot_url`, `failure_reason`.

## Execution order (recommended)

1. Cross-cutting base classes + `portals` config table (1.5 h) — prevents Tier 1 from being 4× boilerplate
2. Tier 1: SmartRecruiters + Workable (90 min) → hits ~87%
3. Tier 1: Recruitee + Teamtailor (60 min) → hits ~90%
4. Tier 2: BuiltIn + YC + Wellfound scrapers (90 min) → hits ~93%
5. Tier 3: USAJobs + Dice (75 min) → hits ~95%

**Total: ~6 hours of focused work for 80% → 95%.**

## Technical notes

- **Files added**: 9 scrapers, 5 apply adapters, 2 base classes, 1 migration (`portals` config table + RLS + grants), 1 page update (`sources.tsx` to surface per-portal config).
- **No new env vars.** Apify token + existing proxies cover all of these.
- **DB change**: new `public.portals` table (owner = service_role-managed, authenticated read-only). Registers a row per supported portal with tunable cadence/maxItems/enabled flags.
- **Worker registry**: replace static dict in `sources/registry.py` and `apply/portals/registry.py` with `pkgutil.iter_modules` auto-discovery.
- **Testing**: each new adapter ships with a fixture-based unit test under `worker/tests/` using a recorded JSON response (no live network in CI).

## Out of scope (explicit)

- Visual UI changes beyond the Sources page per-portal config row
- Touching existing scrapers' logic (only the registry import line changes)
- Cost-savings work (already shipped in previous sprint)
- New notification channels

Approve to proceed, or tell me which tier to drop.