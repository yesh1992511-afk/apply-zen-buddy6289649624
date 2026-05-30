# Publish first, Stripe after

## Step 1 — Publish

You click **Publish** in the top-right of the editor. I can't trigger it; the button is yours. While it deploys (~30s) I'll wait.

## Step 2 — Live QA (I drive)

Once the production URL is live I will:

1. Hit the home page, check title/meta/favicon render.
2. `curl` each `/api/public/*` endpoint on the stable `project--{id}.lovable.app` host with the anon key to confirm hooks respond 200.
3. Walk the live site logged in as you: open `/dashboard`, `/sources`, `/jobs`, `/applications`, `/billing`, `/extension`. Capture any console errors or broken loaders.
4. Confirm `extension.zip` downloads from `/extension`.
5. Report a short pass/fail list. No fixes mid-walk — I'll batch them.

I will **not** sign up new accounts (single-user gate blocks it) and I will **not** click Upgrade (Stripe isn't wired yet).

## Step 3 — Enable Stripe

When QA is clean, I run `recommend_payment_provider` then `enable_stripe_payments`. You fill the short form (email, business name). After it returns I:

1. Wire `/billing` Upgrade buttons to a server fn that creates a Stripe checkout session for the selected plan.
2. Add `/api/public/stripe/webhook` (signature-verified) that upserts `subscriptions` on `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`.
3. Add a "Manage billing" button → Stripe customer portal session.
4. Test mode end-to-end with a 4242 card.

## Out of scope this round

- Multi-seat / team billing
- Stripe Tax beyond calculation
- Annual pricing toggle
- Coupons

---

Ready when you click Publish. Reply once it's done (or just say "published") and I'll start the live walk.