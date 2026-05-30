# Plan: Owner upgrade + US-focused profile with proper inputs

## 1. Make you full owner (admin privileges)

You're already `owner` (auto-assigned on signup). To unlock the **Admin console** (`/admin/*` — observability, audit, flags, plans, system), I'll also grant you the `admin` role.

- Insert `('your-user-id', 'admin')` into `user_roles`
- This gives access to every `/admin` route gated by `has_role(uid, 'admin')`

## 2. Billing — unlimited on Free for the owner

Two clean options. I recommend **Option A** since this is your single-user instance:

- **A. Owner bypass (recommended):** Any user with role `owner` bypasses plan limits in `billing.functions.ts` / quota checks. Billing page shows "Owner — unlimited" badge instead of plan bars. No DB change to `plans` needed.
- **B. Edit Free plan:** Update `plans` row `key='free'` → `max_applies_per_day = 9999`, `max_sources = 9999`. Simpler but also affects any future user.

Going with **A** unless you say otherwise.

## 3. US-focused profile with full option sets

Right now most profile fields are free-text. I'll convert the onboarding wizard + profile editor to use **dropdowns / radio / multi-select / date pickers** with US-defaults everywhere companies actually ask.

### Fields converted to option pickers

| Field | Input type | Options |
|---|---|---|
| Country | Select, default **United States** | Full ISO list, US pinned |
| State | Select | All 50 US states + DC + territories |
| City | Combobox | Top US metros + free type |
| Work authorization | Radio | US Citizen / Green Card / H1B / OPT/CPT / TN / L1 / Other / Not authorized |
| Requires sponsorship now | Radio | Yes / No |
| Requires sponsorship future | Radio | Yes / No |
| Visa status | Select | Same as work auth |
| Visa expiry | **Date picker** (calendar popover) | — |
| Date of birth | **Date picker** | — |
| Earliest start date | **Date picker** | — |
| Gender | Select | Male / Female / Non-binary / Prefer not to say |
| Pronouns | Select | he/him, she/her, they/them, other, prefer not to say |
| Ethnicity (EEO) | Select | Standard US EEOC categories |
| Veteran status | Select | EEOC vet categories |
| Disability status | Select | Yes / No / Prefer not to say (ADA standard) |
| LGBTQ+ status | Select | Yes / No / Prefer not to say |
| Race/ethnicity disclosure | Toggle | — |
| Remote preference | Radio | Remote / Hybrid / Onsite / Any |
| Employment types | Multi-select | Full-time / Part-time / Contract / Internship / Temporary |
| Seniority level | Multi-select | Intern / Entry / Mid / Senior / Lead / Staff / Principal / Director / VP / C-level |
| Salary period | Select | Yearly / Monthly / Hourly |
| Salary currency | Select, default **USD** | Major currencies |
| Notice period | Select | Immediate / 1 wk / 2 wks / 1 mo / 2 mos / 3 mos |
| Travel willingness | Select | None / Up to 25% / Up to 50% / Up to 75% / 100% |
| Shift preference | Select | Day / Evening / Night / Rotating / Any |
| Security clearance | Select | None / Public Trust / Confidential / Secret / Top Secret / TS/SCI |
| Drivers license | Radio | Yes / No |
| Own transport | Radio | Yes / No |
| Has passport | Radio | Yes / No |
| Industries (desired/excluded) | Multi-select | Standard NAICS-style industry list |
| Languages → proficiency | Select | Native / Fluent / Professional / Conversational / Basic |
| Skills → proficiency | Select | Beginner / Intermediate / Advanced / Expert |
| Education → degree | Select | High School / Associate / Bachelor's / Master's / MBA / PhD / Other |
| Cover letter tone | Select | Professional / Friendly / Enthusiastic / Concise / Formal |

### Date pickers
Use shadcn `Calendar` inside `Popover` (with `pointer-events-auto`) for every date field — DOB, visa expiry, earliest start, education start/end, experience start/end, certification issued/expiry.

### Files touched
- `src/routes/_authenticated/onboarding.tsx` — wizard steps swapped to dropdowns + calendars
- `src/routes/_authenticated/profile.tsx` (or wherever profile editor lives) — same input upgrades
- New `src/lib/profile-options.ts` — central source for all option lists (states, countries, visa types, EEO, industries, etc.)
- New `src/components/DatePickerField.tsx` — reusable calendar field
- `src/routes/_authenticated/billing.tsx` — owner badge + bypass display
- `src/lib/billing.functions.ts` / quota checks — owner role bypass

## Out of scope (ask if you want them)
- Editing Free plan limits globally (Option B)
- Adding non-US states/provinces in the same dropdown
- Live Stripe checkout (you already said test/single-user)

Approve and I'll ship it in one pass.