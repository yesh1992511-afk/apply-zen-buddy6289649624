Fix the Visa status dropdown reset bug in `src/routes/_authenticated/profile.tsx`.

## Change
Replace the stale-state `set` helper with a functional updater so chained calls in the same handler compose correctly:

```ts
const set = (k: string, v: unknown) =>
  setP((prev) => (prev ? { ...prev, [k]: v } : prev));
```

## Why
The current `set` reads `p` from closure. When the visa onChange calls `set("visa_status", v)` and `set("work_authorization", v)` back-to-back, both see the same stale `p` and the second call overwrites the first — dropping `visa_status`. Same bug affects the sponsorship dropdown (`needs_visa_future` + `requires_sponsorship`).

## Scope
- One-line change in `src/routes/_authenticated/profile.tsx`
- No schema, API, or other component changes