# Wire all 30+ scraping sources, fully professional

All required secrets are already configured (`APIFY_TOKEN`, `USAJOBS_API_KEY`, `USAJOBS_USER_AGENT_EMAIL`, `DECODO_*` proxy, `CAPSOLVER_API_KEY`). The remaining work is **seeding the right Config JSON for each source** and verifying they all return jobs.

---

## What gets done

### 1. Migration — seed configs + enable every source

A SQL migration that, for the current user, **upserts a row in `public.sources` for every adapter** in the registry with:
- a sensible default `cadence_minutes`
- `enabled = true`
- a production-grade `config` JSON tailored per source

**ATS boards** (Greenhouse, Lever, Ashby, SmartRecruiters, Workable, Recruitee, Teamtailor, BambooHR, Personio, BreezyHR, Jobvite, iCIMS) get a curated **50-company pack** of top tech employers per board type. Workday gets a curated `sites[]` list (Salesforce, NVIDIA, JPMC, Capital One, Deloitte, Accenture, etc.).

**Apify sources** (LinkedIn × 2, Indeed × 2, ZipRecruiter, Google Jobs, Glassdoor, Wellfound) get default `queries`, `locations`, `posted_within_days` matching the user's automation_settings target titles.

**USAJobs / Dice / LevelsFyi / ClearedJobs / CyberSec / Infosec / HN** get `queries` arrays derived from the same target titles.

**Free remote APIs** (RemoteOK, Remotive, WeWorkRemotely, Arbeitnow, YC, Work-At-A-Startup, HN-Who-Is-Hiring) need no config — just enabled.

### 2. UI — "Seed defaults" + "Run all due now" buttons on `/sources`

Two top-bar actions in `sources.tsx`:
- **Seed defaults** — calls a server function that re-applies the curated pack (idempotent, preserves user customizations via `ON CONFLICT DO NOTHING` semantics for `config`).
- **Run all enabled** — queues a `worker_commands` row with `kind = "sources.run_all"` so the worker drains every due source in one pass.

A new **status legend** row at the top showing counts: `X enabled • Y healthy • Z failing • W idle` so the user sees system health at a glance.

### 3. Worker — `sources.run_all` command handler

Add a handler in the worker command dispatcher that iterates `ADAPTERS`, runs each enabled source for the user sequentially with a 5s gap, and writes a single summary `application_event` / log row.

### 4. Adapter hardening (small, targeted)

- **All Apify adapters** — route through Decodo proxy when `DECODO_HOST` is set (better residential success rate). Already present in `_http.py` — just ensure each adapter calls it.
- **Dice / LevelsFyi / ClearedJobs** — use Decodo proxy by default (HTML scrape sources need it).
- **USAJobs** — confirm it reads `USAJOBS_USER_AGENT_EMAIL` (already does) and split into multiple `queries` per source row.

### 5. Verification

After migration runs:
1. Open `/sources` → confirm all sources show `ON`, healthy status legend.
2. Click **Run all enabled** → wait ~60s.
3. Open `/jobs` → confirm new rows from at least: RemoteOK, Remotive, Greenhouse, Lever, USAJobs, and one Apify source.
4. Any source still red after run → surface its `last_error` in the existing error chip (already wired).

---

## Files

**Migration**
- `supabase/migrations/<ts>_seed_all_sources.sql` — upserts 30+ source rows with curated configs

**Frontend**
- `src/routes/_authenticated/sources.tsx` — add "Seed defaults" + "Run all enabled" buttons + status legend
- `src/lib/sources.functions.ts` — new server fn: `seedDefaultSources()`, `runAllEnabledSources()`

**Worker**
- `worker/app/commands.py` (or wherever command dispatch lives) — add `sources.run_all` handler
- `worker/app/sources/dice.py`, `levelsfyi.py`, `cleared_jobs.py` — opt into Decodo proxy
- `worker/app/sources/_http.py` — small helper `proxied_client()` if not already present

---

## Curated company packs (preview)

- **Greenhouse (50)**: stripe, airbnb, discord, doordash, instacart, robinhood, brex, ramp, mercury, plaid, anduril, scale, retool, vercel, linear, notion, figma, asana, gitlab, hashicorp, datadog, mongodb, snowflake, databricks, confluent, cloudflare, twilio, segment, mixpanel, amplitude, posthog, gusto, rippling, deel, faire, shopify, square, coinbase, opensea, alchemy, openai, anthropic, perplexity, character, cohere, huggingface, replicate, runway, scaleai, weave
- **Lever (50)**: netflix, spotify, github, eventbrite, lyft, postmates, blockchain, kraken, circle, gemini, mux, cockroachlabs, fivetran, hex, retool, supabase, neon, render, fly, planetscale, prismaio, vercelhq, modal, langchain, replit, glean, mem, linear, raycast, arc, vanta, drata, rippling, deel, faire, alloy, plaid, brex, ramp, mercury, attentivemobile, klaviyo, gong, outreach, salesloft, lattice, betterup, calm, headspace, oura
- **Ashby (40)**: notion, ramp, figma, openai, anthropic, perplexity, character, cohere, mistral, decagon, harvey, hex, retool, vercel, linear, supabase, neon, render, modal, replicate, runway, scale, gusto, rippling, deel, brex, mercury, plaid, alloy, vanta, drata, sigma, omni, mode, hex, glean, mem, raycast, arc, lattice
- **Workable / Recruitee / Teamtailor / Personio / BambooHR / BreezyHR (30 each)** — top EU + US mid-market employers
- **Workday sites (25)**: salesforce, nvidia, capitalone, jpmc, deloitte, accenture, mckinsey, bcg, bain, pwc, ey, kpmg, walmart, target, disney, comcast, verizon, att, ibm, cisco, oracle, sap, vmware, dell, hp

---

## Risk notes (plain language)

- Apify actors cost ~$0.001-0.01 per result. Default `posted_within_days = 3` keeps cost low.
- HTML scrape sources (Dice/LevelsFyi) may still fail intermittently — Decodo proxy helps but isn't 100%. The `last_error` chip in the UI will tell you which ones need a config tweak.
- Workday sites vary per company URL — the curated list uses verified slugs but a few may 404 if the company rebrands; we surface that as a per-source error, not a global failure.

After approval I'll apply the migration, ship the UI buttons, and you can click **Run all enabled** to see jobs flow in within a minute.