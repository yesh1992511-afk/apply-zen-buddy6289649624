## What I found

Your backend is healthy and the source secrets are already present. You do **not** need to give me USAJobs API again right now.

Current failing/stale items break down like this:

- `apify:glassdoor` is failing with `403 Forbidden` from the Apify actor. That usually means the selected Glassdoor actor is unavailable, paid/private, blocked for your Apify account, or the actor slug changed. Your Apify token exists, but this specific actor is refusing the run.
- `himalayas` is failing with `RangeError: Invalid time value`, which is a code parsing bug in the adapter, not something you need to provide.
- Many board/API sources show `null`/stale because they have never completed a run yet, not because credentials are missing.

## Plan

1. **Fix real adapter bugs**
   - Patch the `himalayas` adapter/date normalization so bad or missing dates never crash a scrape.
   - Harden source status updates so one bad job row cannot mark the whole source failed.

2. **Make Apify sources professional and fault-tolerant**
   - Replace or fallback the failing Glassdoor actor with a working configurable Apify actor path.
   - Add better Apify error messages: distinguish bad token, actor forbidden/private, no credits, rate limit, and no results.
   - Keep using your existing `APIFY_TOKEN`; no new key needed unless Apify itself says your account cannot access that actor.

3. **Clean up stale/never-run source health**
   - Change the `/sources` UI so `never run` is shown as `Idle`, not scary failed/stale.
   - Only show `Failed` when there is a real `last_error` from a recent run.
   - Add a clearer “Needs attention” section listing only sources that require action.

4. **Add a real “Run all enabled sources” worker command if missing**
   - Ensure the button queues a backend worker command that runs enabled sources in batches instead of only changing UI state.
   - Make the worker write a summary log and per-source status updates.

5. **Verify results**
   - Query source statuses after a run and confirm which sources are healthy, which are simply idle, and which still need external account action.
   - If only Glassdoor remains blocked, I’ll tell you the exact Apify actor/account setting needed; otherwise no manual setup from you.

## Manual setup expected from you

For now: **nothing new**.

Only possible exception: if Apify rejects the Glassdoor actor because your Apify account cannot access that paid/private actor, you’ll need to either subscribe to that actor in Apify or let me switch Glassdoor to another actor/source.