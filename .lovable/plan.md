## Goal
Add a **Sync to Resume** button at the top-right of `/profile` that:
1. Renders the user's profile data into your LaTeX template
2. Saves a versioned `.tex` to the `resumes` table + `resumes` storage bucket
3. Offers a one-click **Download PDF** action that compiles on-demand

---

## 1. LaTeX template + renderer (server-side)

**New file: `src/lib/resume-template.ts`**
- Exports the LaTeX preamble + section formatting commands from your `.tex` file as a constant (the lines 1–62 boilerplate stays identical).
- Exports `escapeTex(s)` that escapes `& % $ # _ { } ~ ^ \` and converts newlines.
- Exports `formatDateRange(start, end)` → `"Jan 2025 -- Present"`.

**New file: `src/lib/resume-render.server.ts`** (server-only helper)
- `renderResumeTex(data)` builds the full `.tex` string by interpolating:
  - **Header**: `full_name` (uppercased), `city, state_region`, `phone`, `email`, `linkedin_url`
  - **Professional Summary**: `profile.summary` (verbatim, escaped)
  - **Professional Experience**: each row from `experiences` → `\resumeSubheading{company}{date_range}{title}{location}` + bullet items split from `description` on newlines
  - **Cybersecurity Projects / Projects**: each row from `projects` → project heading block + tech stack italic line + bullets
  - **Technical Skills**: rows from `skills` grouped by `category` → one `\item \textbf{category:} comma,list`
  - **Certifications**: rows from `certifications` → `\item \textbf{name} (year)`
  - **Education**: rows from `educations` → `\resumeSubheading{school}{date_range}{degree | GPA}{location}`
  - **Publications**: rows from `publications` → `\item authors. "title." venue, date. url. description`
- Sections render with empty-state guard (skipped if no rows).

## 2. Server function: sync + PDF compile

**New file: `src/lib/resume.functions.ts`**

```ts
export const syncResumeFromProfile = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // 1. load profile + all 6 child tables
    // 2. compute completion %, throw if < 80
    // 3. render tex
    // 4. slugify full_name → "yeswanth_reddy_chilakala"
    // 5. find existing default-synced resumes for user, compute next vN
    // 6. upload tex to resumes/{user_id}/{slug}_v{n}.tex
    // 7. insert into resumes (kind='synced', is_default=true on first, name='yeswanth_reddy_chilakala_v3')
    //    unset is_default on prior synced rows
    // 8. return { id, name, storage_path }
  })

export const compileResumePdf = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ resume_id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    // 1. fetch resume (RLS ensures ownership)
    // 2. POST tex to https://latexonline.cc/compile (text=...)
    // 3. upload pdf to resumes/{user_id}/{slug}_v{n}.pdf
    // 4. update resumes.pdf_storage_path
    // 5. return signed URL valid 60s
  })
```

**Compile strategy**: use **latexonline.cc** (free, public, no key) — `GET https://latexonline.cc/compile?text=<urlencoded tex>` returns a PDF. Falls back gracefully with an error toast if the service is down.

## 3. UI changes

**Edit: `src/routes/_authenticated/profile.tsx`**
- Add `useProfileCompletion()` hook that returns `0–100` based on filled fields across profile + presence of ≥1 row in experiences/projects/skills/educations.
- Add top-right action group next to the page title:
  - Badge: `Completion: 87%`
  - Button **Sync to Resume** (disabled with tooltip "Profile must be ≥80% complete" if below 80)
  - On success: toast "Saved as yeswanth_reddy_chilakala_v3" + link "View in Resumes"

**Edit: `src/routes/_authenticated/resumes.tsx`**
- For each resume row, add a **Download PDF** button that calls `compileResumePdf`, then triggers browser download from the returned signed URL.
- Add **Download .tex** button (uses existing `storage_path` signed URL).
- Show a "Synced" badge for `kind='synced'` rows; mark `is_default` with a star.

## 4. Database

No schema change needed — `resumes` table already has `tex_content`, `storage_path`, `pdf_storage_path`, `is_default`, `kind`, `name`. Only changes:
- Add a `kind` value `'synced'` (free-text already).
- Storage bucket `resumes` already exists; ensure folder convention `{user_id}/...`.

## 5. Out of scope
- AI rewriting / tailoring per job
- Editing tex in-browser
- Multiple template choices (only your provided template)
- ATS scoring

---

**Files touched:**
- new: `src/lib/resume-template.ts`, `src/lib/resume-render.server.ts`, `src/lib/resume.functions.ts`
- edit: `src/routes/_authenticated/profile.tsx`, `src/routes/_authenticated/resumes.tsx`
