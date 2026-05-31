# Make compiled resume PDFs visible (bypass ad blockers)

## Problem
Opera/uBlock blocks the Supabase Storage subdomain (`iarfebnnnoswymgfvnel.supabase.co`), so the compiled resume PDF fails to load in the preview iframe with `ERR_BLOCKED_BY_CLIENT`.

## Fix
Stream the PDF through our own app domain so the browser only sees a same-origin URL.

## Changes

### 1. New server route — `src/routes/api/pdf.$id.ts`
- Path: `/api/pdf/$id` where `$id` is the resume row id
- `GET` handler:
  - Require auth via `requireSupabaseAuth` middleware (or check session cookie) so users can only fetch their own resume
  - Look up `resumes` row by id, confirm `user_id = auth.uid()`, read its `storage_path`
  - Use `supabaseAdmin.storage.from('resumes').download(storage_path)` to get the bytes
  - Return `new Response(blob, { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'inline; filename="resume.pdf"', 'Cache-Control': 'private, max-age=60' } })`
  - 404 if missing, 403 if not owner, 401 if unauthenticated

Note: Server routes can't use `requireSupabaseAuth` middleware (that's for serverFns). We'll read the `Authorization: Bearer` header or the Supabase auth cookie, validate it with `supabaseAdmin.auth.getUser(token)`, then check ownership.

### 2. Update PDF viewer call sites
- Replace `getResumePdfUrl()` (signed Supabase URL) with `/api/pdf/${resumeId}` in components that embed the compiled resume preview (e.g. resume preview dialog, profile, applications detail).
- Keep `getResumePdfUrl` for explicit "download" links if desired, but switch the iframe/embed `src` to the proxy route.

### 3. Pass auth to the proxy
Since `<iframe src>` can't set headers, the route must accept either:
- the Supabase auth cookie (works because same-origin), OR
- a short-lived signed token in the URL (`?token=...`)

Simplest: rely on the Supabase auth cookie that's already on the app's domain. Validate via `supabaseAdmin.auth.getUser(accessTokenFromCookie)`.

## Files touched
- `src/routes/api/pdf.$id.ts` (new)
- 1–2 components that render the compiled PDF preview (search for `getResumePdfUrl` and iframe/embed of resume URL)

## Out of scope
- No DB schema changes
- No worker changes
- No styling changes
