# Add Publications + fix profile bugs

## A. New `publications` section

**Migration** — new `public.publications` table:

```sql
CREATE TABLE public.publications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL DEFAULT '',
  authors text,                -- comma-separated list of co-authors
  venue text,                  -- journal / conference / publisher
  publication_date date,
  url text,
  doi text,
  description text,
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.publications TO authenticated;
GRANT ALL ON public.publications TO service_role;
ALTER TABLE public.publications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner full access" ON public.publications
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
```

**Profile UI (`src/routes/_authenticated/profile.tsx`)**:
- Add a `publications` entry to the `SCHEMAS` map with fields: `title`, `authors`, `venue`, `publication_date` (date), `url`, `doi`, `description`.
- Add `<TabsTrigger value="publications">Publications</TabsTrigger>` between Certs and References.
- Add `<TabsContent value="publications"><ListSection table="publications" /></TabsContent>`.
- Extend `buildBlank()` NOT-NULL seed for `publications` (`title = ""`).
- Extend the ordering branch in `load()` so `publications` orders by `sort_order` (already the default branch — fine).

**Worker / ATS map (`worker/app/apply/profile_map.py`)**: add a `publications` aggregator that joins title + venue + year so portal questions like "List notable publications" auto-fill from the new table.

## B. Profile bug fixes

1. **Redundant page-wide flush** — `<div onBlurCapture={() => flush()}>` at the top of `ProfilePage` fires on every blur inside list-section cards too, queuing profile-editor writes that have nothing to save. Move the `onBlurCapture` wrapper from the outer page `div` onto the form `<Tabs>` content for the profile-editor-driven tabs only (Basic / Address / Work auth / Comp / Compliance / Preferences / Links / Screening). List sections (Experience / Projects / Skills / Education / Languages / Certs / Publications / References) handle their own saves and must not trigger profile flush.

2. **"Years experience" number parse** — `set("years_experience", v ? Number(v) : null)` happily accepts negatives and `Number(".")` → NaN. Clamp: parse, then `Number.isFinite(n) && n >= 0 ? n : null`. Set `min={0}` on the `<Input type="number">`.

3. **`<SelectField allowCustom>` clear** — Compliance tab uses `SelectFieldKV` for `criminal_record_disclosure`, `notice_period_category`, `travel_willingness_pct`. Once a value is set you can't unset to "no answer". Add a small "Clear" link next to the trigger when value is non-empty, calling `onChange("")`/`onChange(null)`.

4. **Duplicate Notice-period UX** — Comp tab has `notice_period_weeks` (numeric weeks) and Compliance tab has `notice_period_category` (immediate/2w/1m…). They drift. Add a hint under each: "Linked to the other notice-period field" so users know they answer the same question two ways; no auto-sync (the worker already prefers `_category` then falls back to `_weeks`).

5. **`void user;` cleanup** — remove the `void user;` line (legacy hint comment) and drop the unused `const { user }` destructure in `ProfilePage` since it isn't referenced.

6. **Auto-seed empty-row guard** — `ListSection.load()` currently always tries to seed a blank row on first empty load. If the seed insert fails (network/RLS), `seededRef` is already flipped, so retry never happens. Reset `seededRef.current[table] = false` inside the `if (error)` branch so a refresh tries again.

## Files touched
- `src/routes/_authenticated/profile.tsx` — Publications schema/tab + 6 bug fixes
- `worker/app/apply/profile_map.py` — publications aggregator
- New migration creating `public.publications` with RLS + grants

## Out of scope
- ORCID / Google Scholar auto-import
- Citation parsing or DOI lookup
- Filter/automation integration of publications
