# Add First/Last Name + Audit Sync Resume

## 1. Database — add first/last name columns

Migration on `public.profile`:
```sql
ALTER TABLE public.profile
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name  TEXT;
```
Backfill from existing `full_name` (first token → first_name, rest → last_name) so existing rows aren't blank.

## 2. Profile UI (`src/routes/_authenticated/profile.tsx`)

In the **Basic** section, add two inputs **before** "Full name":
- First name → `first_name`
- Last name  → `last_name`

Auto-sync behavior: when both first & last are filled and `full_name` is empty (or matches the previous auto-value), set `full_name = first + " " + last`. Keeps `full_name` populated for everywhere else that already reads it.

Add `first_name` + `last_name` to the completion-percentage field list so the 80% gate reflects them.

## 3. Resume filename (`src/lib/resume.functions.ts` + `resume-template.ts`)

Change slug source from `full_name` → `${first_name}_${last_name}` when both exist, otherwise fall back to slugified `full_name`. Result: `yeswanth_reddy_chilakala_v1.tex`. Versioning logic (`_v1`, `_v2`, …) unchanged.

Also pass `first_name`/`last_name` into the renderer so the LaTeX **header name** uses `"First Last"` exactly as entered (not uppercased mash of full_name).

## 4. Audit & fix Sync Resume end-to-end

Walk the full path and fix issues found:

**a. Profile completeness gate** — verify `useProfileCompletion` counts the right fields, no off-by-one, and the button tooltip shows the live percentage.

**b. Pre-sync flush** — confirm pending edits in the profile form actually `flush()` before `syncResumeFromProfile` reads the DB (race condition risk).

**c. Renderer (`resume-render.server.ts`)** — for each section, verify:
- empty sections are omitted (no stray `\section{}` blocks),
- `escapeTex` handles `& % $ # _ { } ~ ^ \`,
- dates render consistently (`MMM YYYY`, "Present" for current roles),
- bullets, tech arrays, and multi-line summary survive escaping,
- Publications section uses new template block (added last turn).

**d. Storage + DB write** — verify `.tex` uploads to `resumes/{user_id}/{slug}_v{n}.tex`, row inserted with `kind='synced'`, `name = ${slug}_v${n}`, `is_default` left alone unless first sync.

**e. Resume page (`resume.tsx`)** — confirm:
- synced rows show "SYNCED" badge,
- Download .tex works (signed URL),
- Download PDF button compiles via `compileResumeToPdf` and triggers browser download with `${slug}.pdf` filename,
- error toasts surface compile failures from latexonline.cc.

**f. Repeat sync** — second click produces `_v2`, doesn't overwrite v1.

## Out of scope
- Renaming `full_name` column (kept for back-compat).
- AI-tailored resumes (separate feature).
- Switching PDF compiler.

## Files touched
- New migration (profile columns + backfill)
- `src/routes/_authenticated/profile.tsx` (2 new fields, completion list)
- `src/lib/resume-template.ts` (slug helper update)
- `src/lib/resume-render.server.ts` (header uses first/last)
- `src/lib/resume.functions.ts` (filename from first_last)
- `src/routes/_authenticated/resume.tsx` (only if audit finds bugs)
