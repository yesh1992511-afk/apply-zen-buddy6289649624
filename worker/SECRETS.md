# Where to get every secret

Copy `.env.example` → `.env` and fill these in. Each section tells you exactly where to click.

---

## 1. Supabase (required) — connects the worker to your Lovable DB

In Lovable → top-right menu → **Cloud** → **Backend** opens the Supabase dashboard for your project.

| Variable | Where |
|---|---|
| `SUPABASE_URL` | Project Settings → API → **Project URL** |
| `SUPABASE_SERVICE_ROLE_KEY` | Project Settings → API → **service_role** key (⚠️ secret, bypasses RLS) |
| `JOBPILOT_USER_ID` | Supabase dashboard → Authentication → Users → copy your user's `id` (UUID) |

---

## 2. Apify (required for LinkedIn / Indeed / Glassdoor / Dice / ZipRecruiter scraping)

Apify hosts the only reliable LinkedIn/Indeed scrapers. ~$5–10/mo for hobby use.

1. Sign up at https://console.apify.com
2. Top-right avatar → **Settings → Integrations → API tokens** → create token
3. `APIFY_TOKEN` = that token

Actor IDs we use (these are public, free to call with your token):
- LinkedIn jobs: `bebity/linkedin-jobs-scraper`
- Indeed jobs: `misceres/indeed-scraper`
- Glassdoor: `bebity/glassdoor-jobs-scraper`
- (configurable in the Sources page)

---

## 3. OpenAI (required for resume tailoring)

1. https://platform.openai.com/api-keys → **Create new secret key**
2. Add ~$10 credit at Billing → Add payment method
3. `OPENAI_API_KEY` = `sk-...`

Default model: `gpt-4o-mini` (~$0.15 per 1M input tokens). Change with `OPENAI_MODEL`.

---

## 4. DeepSeek (required for JD reasoning — much cheaper than OpenAI for analysis)

1. https://platform.deepseek.com → sign up
2. **API Keys** → create key
3. Top up $2 (lasts months)
4. `DEEPSEEK_API_KEY` = `sk-...`

Default model: `deepseek-reasoner` for analysis, `deepseek-chat` for fast calls.

---

## 5. Captcha solver (required — picks ONE)

Pick whichever you already use; the worker auto-routes by `CAPTCHA_PROVIDER`.

| Provider | Sign-up | Cost |
|---|---|---|
| **2Captcha** | https://2captcha.com → Dashboard → API Key | ~$3 per 1000 captchas |
| **CapSolver** | https://www.capsolver.com → Dashboard → API Key | similar |
| **Anti-Captcha** | https://anti-captcha.com → Settings → API setup | similar |

Then set:
- `CAPTCHA_PROVIDER` = `2captcha` | `capsolver` | `anticaptcha`
- `CAPTCHA_API_KEY` = the key from your dashboard

---

## 6. Residential proxies (required for LinkedIn / Workday to avoid IP bans)

Pick ONE. Datacenter proxies will get you banned within hours — use **residential** or **mobile**.

| Provider | Cheapest plan | Notes |
|---|---|---|
| **IPRoyal** royalresidential | https://iproyal.com — ~$1.75/GB | Best $/GB, simple |
| **Smartproxy** residential | https://smartproxy.com — ~$2.5/GB | Good rotation control |
| **BrightData** ISP | https://brightdata.com | Most reliable, pricier |

From the provider dashboard you'll get a `host:port` and `username:password`:
- `PROXY_HOST` = e.g. `geo.iproyal.com`
- `PROXY_PORT` = e.g. `12321`
- `PROXY_USER` = your subuser
- `PROXY_PASS` = the password
- `PROXY_COUNTRY` = `US` (or whatever; matches your target job market)

---

## 7. Gmail OAuth (required for reading OTP / verification emails)

Some portals (LinkedIn, Workday) email a 6-digit code. The worker reads it via Gmail API.

**Best path — Google Cloud Console:**

1. https://console.cloud.google.com → New Project "JobPilot"
2. **APIs & Services → Enable APIs** → enable **Gmail API**
3. **OAuth consent screen** → External → fill in app name + your email → publish
4. **Credentials → Create Credentials → OAuth client ID** → Application type **Desktop app** → Create
5. Download the JSON, you'll see `client_id` and `client_secret`
6. Generate a refresh token (one-time, from your laptop):
   ```bash
   docker run --rm -it -v $PWD:/work -w /work python:3.12-slim \
     bash -c "pip install -q google-auth-oauthlib && python -c '
   from google_auth_oauthlib.flow import InstalledAppFlow
   f = InstalledAppFlow.from_client_secrets_file(\"client.json\",
     [\"https://www.googleapis.com/auth/gmail.readonly\"])
   c = f.run_local_server(port=0)
   print(\"REFRESH:\", c.refresh_token)
   '"
   ```
7. Paste into `.env`:
   - `GMAIL_OAUTH_CLIENT_ID`
   - `GMAIL_OAUTH_CLIENT_SECRET`
   - `GMAIL_OAUTH_REFRESH_TOKEN`
   - `GMAIL_EMAIL` (the address that receives the OTPs)

---

## 8. Apply credentials (you control)

Set the email + password the bot will use when creating accounts on portals (LinkedIn, Greenhouse, Lever, etc.). Use a dedicated email if possible.

- `APPLY_EMAIL`
- `APPLY_PASSWORD`
- `APPLY_DEFAULT_PHONE` (US format `+15551234567` — used for forms)

---

## 9. Optional — alerting

- `ALERT_WEBHOOK_URL` = a Slack / Discord webhook for failures (optional)
