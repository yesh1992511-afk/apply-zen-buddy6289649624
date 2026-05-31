# Wire Decodo as a Proxy Provider

Decodo is referenced in the Setup page copy but is missing from the Automation page's Proxy provider dropdown, and there's no secrets wiring for it. This plan adds it cleanly across the UI, validation, secrets, and readiness check.

## Scope

1. **Automation page (`src/routes/_authenticated/automation.tsx`)**
   - Add `<SelectItem value="decodo">Decodo</SelectItem>` to the Proxy provider Select (make it the first option since the rest of the stack already uses Decodo per `setup.tsx:252`).
   - Default `proxy_provider` to `"decodo"` when null on first render (write-through on first change only — don't override an existing choice).
   - When `proxy_provider === "decodo"`, render a small inline panel under the dropdown with:
     - Status badge ("Configured" / "Not configured") driven by `secrets_meta` rows whose `name` ∈ {`DECODO_USERNAME`, `DECODO_PASSWORD`, `DECODO_HOST`} and `status = 'set'`.
     - A "Configure Decodo credentials" button that opens a dialog with 3 inputs (`DECODO_USERNAME`, `DECODO_PASSWORD`, `DECODO_HOST` with default `gate.decodo.com:7000`) and saves them via the existing secrets flow (`secrets_meta` upsert + secret values stored through the platform's `add_secret` mechanism — same pattern as the captcha provider section if present, otherwise via the existing secrets page link).

2. **Validation (`src/lib/validation/settings.ts`)**
   - Tighten `proxy_provider` enum: `z.enum(["decodo","iproyal","brightdata","smartproxy","oxylabs"]).nullable().optional()`.

3. **Readiness (`src/lib/readiness.functions.ts`)**
   - Already checks `category === "proxy"` generically — no change needed, but bump label detail to mention the active `proxy_provider` from `automation_settings` so the readiness card reads "Configured (Decodo)" instead of just the secret name.

4. **Setup page (`src/routes/_authenticated/setup.tsx`)**
   - Replace the static "Decodo residential proxies" bullet with a link pointing to `/automation#proxy` so users land directly on the new config panel.

## Out of scope

- Actually performing proxy requests from the worker (worker code lives outside this repo).
- Renaming `proxy_provider` column.
- Adding non-Decodo provider config dialogs (only Decodo gets the inline credential panel in this pass).

## Files touched

- `src/routes/_authenticated/automation.tsx` (add option + Decodo panel + dialog)
- `src/lib/validation/settings.ts` (enum)
- `src/lib/readiness.functions.ts` (detail label)
- `src/routes/_authenticated/setup.tsx` (link bullet)

No DB migration required — `proxy_provider` is already a free-form `text` column and `secrets_meta` already supports `category = 'proxy'`.
