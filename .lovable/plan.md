# Inline JD preview on matched job cards

Show a short, readable snippet of the job description on each card in `/jobs` so the JD is visible at a glance without opening the dialog or detail page. The existing "Description" button (full dialog) stays for the complete read.

## Scope

- File: `src/routes/_authenticated/jobs.tsx` only.
- Frontend/presentation only. No schema, query, or worker changes — `description` and `description_html` already come back on the `Job` type from `src/lib/queries/jobs.ts` and are scraped by the worker.

## What changes

1. Add a small helper inside the file, `jdSnippet(j)`, that:
   - Prefers `j.description` (plain text).
   - Falls back to `j.description_html` stripped of tags (regex strip `<[^>]+>`, decode a few common entities like `&amp;`, `&nbsp;`, `&lt;`, `&gt;`, `&#39;`, `&quot;`) and collapsed whitespace.
   - Returns `null` if nothing usable.

2. In the card JSX (between the meta row / salary chip and the bottom action bar, around line 296), render:
   - A `<p>` with `line-clamp-3 text-xs text-muted-foreground/90 leading-relaxed` showing the snippet.
   - Only when `jdSnippet(j)` is truthy.
   - No "Read more" link — the existing "Description" button already opens the full dialog.

3. Card already uses `flex flex-col` with `mt-auto` on the action bar, so the snippet naturally pushes the footer down and cards in the grid stay aligned via the grid's implicit row height. No layout overhaul needed.

## Out of scope

- No change to dialog, detail page, or worker.
- No new dependency for HTML sanitization — snippet is plain text only, never rendered as HTML.
- No truncation length tuning beyond `line-clamp-3`.
