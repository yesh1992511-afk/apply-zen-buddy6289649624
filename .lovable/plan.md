## Plan

The app itself appears to load, but the LaTeX PDF preview is stuck at **Compiling…** because `compile_resume` is queued while the worker is offline/paused. I’ll make the UI fail gracefully instead of waiting indefinitely.

## Changes

1. **Stop the stuck loading state**
   - Update the resume compile flow so `compiling` is always cleared after timeout, failure, or queue errors.
   - Show a clear message like “Worker offline — compile queued but not processed” instead of leaving the PDF pane on “Compiling…”.

2. **Detect worker availability before compiling**
   - Check `worker_heartbeat` before enqueueing compile work.
   - If the worker heartbeat is stale/missing, warn immediately and avoid presenting it as an active compile.

3. **Improve command polling feedback**
   - Keep polling short for preview compiles.
   - Treat `pending` commands after timeout as queued/offline rather than generic “compile failed: timeout”.

4. **Validate the result**
   - Confirm the Profile resume page no longer stays stuck when the worker is offline.
   - Confirm successful worker responses still load a signed PDF URL when available.

## Technical notes

- Primary files: `src/routes/_authenticated/profile.tsx`, `src/lib/commands.ts`.
- No database schema change is needed.
- This does not start/fix the external worker itself; it fixes the app behavior so the UI accurately reports that the worker is offline/paused instead of hanging.