# Security Scan Results — Prioritized

Ran the platform security scan + Supabase linter. Earlier critical issues (auth-middleware JWT verification, `rescore_all_jobs_for_user` exec grants, `jd_analysis_cache` open SELECT, storage WITH CHECK, realtime RLS) are confirmed fixed. Four remaining items, prioritized:

## P1 — Medium

### 1. PostgREST filter injection in `FilterPreview`
**File:** `src/routes/_authenticated/filters.tsx`
User keywords are interpolated directly into `supabase.from('jobs').or(...)`. PostgREST parses `,`, `.`, `(`, `)` as operators, so a crafted keyword can inject extra predicates. RLS on `jobs` limits blast radius to the user's own rows today, but it's a footgun.

**Fix:** Sanitize keywords (reject/strip `,().*`) before building the `.or()` string, OR replace with chained `.ilike()` calls / a server function with Zod validation.

### 2. External error body forwarded to client in `compileResumeToPdf`
**File:** `src/lib/resume.functions.ts`
Raw response from `latexonline.cc` (up to 300 chars) is thrown back to the browser, potentially leaking compiler stack traces / paths.

**Fix:** `console.error` the raw body server-side, throw a generic `"PDF compilation failed…"` to the client.

## P2 — Low / Informational

### 3. Extension in `public` schema (WARN)
Pre-existing, documented as accepted risk in `security-memory.md`. **Recommend: ignore** (no action) and keep the memory note.

### 4. "RLS enabled, no policy" (INFO)
Lowest severity — table has RLS on but no policy, meaning it's locked to service_role only. This is intentional for `jd_analysis_cache` (fixed last round). **Recommend: ignore** as intentional.

## Proposed actions (build mode)
1. Patch `src/routes/_authenticated/filters.tsx` — sanitize keywords for `.or()`.
2. Patch `src/lib/resume.functions.ts` — sanitize compiler error surface.
3. Mark findings #3 and #4 as ignored with explanations in security memory.
4. Re-run scanner to confirm green.

Approve to switch to build mode and apply.
