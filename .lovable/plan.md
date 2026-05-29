# Scraping Strategy — Best-of-Breed Multi-Source

Got it — I'll treat the actors you gave me as **one input among several**, and pick the best source per portal based on freshness, cost, and reliability. No portal will rely on a single brittle path.

## Source Matrix (per portal)

| Portal | Primary | Fallback | Why |
|---|---|---|---|
| **LinkedIn** | `bebity/linkedin-jobs-scraper` (Apify, ~$5/1k, faster + cheaper than curious_coder) | `curious_coder/linkedin-jobs-scraper` (yours) | bebity is the community gold-standard; curious_coder kept as warm fallback |
| **Indeed** | `misceres/indeed-scraper` (Apify, cheapest, geo-aware) | `apify/indeed-scraper` (official) | misceres is the most reliable Indeed actor in 2025 |
| **ZipRecruiter** | `crawlerbros/ziprecruiter-scraper-pro` (yours) | direct API via `zippia` mirror | your actor is solid here |
| **Google Jobs** | `khadinakbar/google-jobs-scraper` (yours) | SerpAPI Google Jobs (paid fallback) | aggregates LI/Indeed/Glassdoor in one call — huge multiplier |
| **Glassdoor** | `bebity/glassdoor-jobs-scraper` | scrape via Google Jobs | direct scraping blocked too often |
| **Remote-first** | RemoteOK API (free), WeWorkRemotely RSS (free), Arbeitnow API (free), Remotive API (free) | — | zero cost, no proxy needed, high signal |
| **YC / startups** | Workatastartup public JSON, Wellfound (Apify `epctex/wellfound-scraper`) | — | best for early-stage roles |
| **Direct ATS** | Greenhouse + Lever public APIs (free, official) | — | when a company is known, hit their board directly — no scraping |

**Net effect:** even if 2 sources break on a given day, the pipeline keeps producing jobs. Google Jobs alone covers ~60% of listings as a safety net.

## Scraping Logic (per run)

1. **Fan-out**: For each user search (role + location), dispatch to all enabled sources in parallel via Apify + free APIs.
2. **Decodo proxy** (`gate.decodo.com:10001`) on every Apify actor + every direct HTTP call (RemoteOK, ATS APIs).
3. **Normalize** to one `Job` schema (title, company, location, remote, salary, url, source, posted_at, jd_text).
4. **Dedupe** across sources: hash of `(normalized_company + normalized_title + location_city)`. Keep the one with richest JD.
5. **Filter engine** runs user rules (keywords, salary floor, exclude companies, seniority, visa, etc.).
6. **Enrich**: company size (Apify `harvestapi/linkedin-company`), funding (Crunchbase free tier when key present), Glassdoor rating (cached 30d).
7. **Persist** to `jobs` table → trigger downstream tailor + apply pipeline.

## Apply Logic (per portal)

Same fallback philosophy:
- **Lever / Greenhouse** → use their public application APIs (no browser needed, 100% reliable, no CAPTCHA). Most ATS submissions go here.
- **Workday** → Playwright + stealth + Decodo + persistent profile per company tenant.
- **LinkedIn Easy Apply** → Playwright + stealth + warm session + Gmail OTP reader.
- **Indeed Easy Apply** → Playwright + CapSolver for reCAPTCHA when triggered.
- **External ATS forms** (Taleo, iCIMS, Workable) → queue as "1-click handoff" in v1, full auto in v2.

## Anti-Detection Stack (applied everywhere)

- `playwright-extra` + `stealth-plugin` (patches 20+ fingerprint vectors)
- UA + `sec-ch-ua` + viewport + timezone + locale rotated per profile
- Persistent browser context per `(user, portal)` → cookies, localStorage, IndexedDB survive across runs (mimics a real returning user)
- Human cadence: Gaussian-distributed think time, mouse curves, scroll-before-click, occasional misclicks
- Per-portal rate limits + exponential backoff + circuit breaker (>3 challenges/10min → pause that portal 1h)
- CapSolver wired for reCAPTCHA v2/v3, hCaptcha, Cloudflare Turnstile, Datadome

## What I'll Build This Turn

1. **Sources layer** — implement all 11 sources above (`worker/app/sources/`), each behind a common `BaseSource` interface, with the matrix above as the default routing config (user can toggle per source in `/settings`).
2. **Proxy + UA rotator** — centralized in `worker/app/apply/proxy.py` + `worker/app/apply/humanize.py`, used by both scraping and applying.
3. **ATS adapters** — Greenhouse + Lever direct-API apply (the highest-ROI win — bypasses browser entirely).
4. **Browser portal adapters** — LinkedIn, Indeed, Workday with full stealth stack.
5. **Dedupe + filter engine** — already scaffolded, now wired end-to-end.
6. **`/setup` page** — VPS one-click deploy (SSH from server function, writes `.env` from secrets, `docker compose up -d`, polls heartbeat).
7. **Secrets** — store the 6 credentials you pasted via `secrets--add_secret`.

## Deferred (next chunk after worker is Online)
- Frontend polish: Dashboard KPIs, Jobs board, Applications timeline w/ screenshots, Logs live tail, drag-drop profile editor, visual filter builder.
- Gmail OAuth `/auth/gmail` flow (only needed once LinkedIn starts asking for email OTP, typically week 2-3).
- v2 external ATS auto-fill (Workable, Taleo, iCIMS).

---

**Ready to switch to build and execute?** Hit Approve and I'll do all 7 items in one shot, then hand you the single SSH command to bootstrap the VPS.
