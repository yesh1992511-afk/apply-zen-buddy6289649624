# Fix: Job description showing as HTML code

## Root cause

The Greenhouse Job Board API returns the `content` field as **HTML-entity-encoded HTML** — i.e. the string literally contains `&lt;div class=&quot;content-intro&quot;&gt;&lt;h2&gt;Join us…` instead of `<div class="content-intro"><h2>Join us…`.

`src/lib/sources/adapters.server.ts` (line 267-268, `fetchGreenhouse`) stores that raw string into both `description` (after a tag-strip regex that does nothing because there are no real tags) and `description_html`.

In `src/components/JobDescriptionDialog.tsx` we then render it via `dangerouslySetInnerHTML`. The browser parses `&lt;` as the literal character `<` and shows it as plain text — exactly what the screenshot shows. The same issue affects any other adapter pulling pre-encoded HTML from Greenhouse-style sources.

Notably this is a Greenhouse-only bug. LinkedIn / Indeed / Lever / Ashby / Workable adapters return real HTML, which already renders correctly.

## Changes

### 1. Decode HTML entities for Greenhouse at scrape time
`src/lib/sources/adapters.server.ts` → `fetchGreenhouse` (around line 267):

- Add a small `decodeHtmlEntities(str)` helper at the top of the file that resolves the common named entities (`&lt; &gt; &amp; &quot; &#39; &nbsp;`) and numeric entities (`&#123;`, `&#x1F;`). Pure string replace — no DOM, safe in the Worker runtime.
- Apply it once to the Greenhouse `content` string, then derive:
  - `description_html = decoded`
  - `description = decoded.replace(/<[^>]+>/g, ' ').slice(0, 8000)` (now the tag-strip actually works, producing real plain text).

### 2. Defensive decode at render time
`src/components/JobDescriptionDialog.tsx`:

- Before passing `description_html` to `sanitizeHtml`, detect entity-encoded content (`/&lt;\w+/i.test(html)`) and decode once. This ensures the ~50+ Greenhouse jobs already stored in the DB render correctly without a backfill migration.
- No change to `sanitizeHtml` itself.

### 3. (Optional, recommended) Backfill existing rows
One SQL migration to clean up rows already in `public.jobs` where `description_html` starts with `&lt;`:

```sql
UPDATE public.jobs
SET description_html = replace(replace(replace(replace(replace(replace(
      description_html,
      '&lt;', '<'), '&gt;', '>'), '&quot;', '"'),
      '&#39;', ''''), '&nbsp;', ' '), '&amp;', '&'),
    description = regexp_replace(
      replace(replace(replace(replace(replace(replace(
        description_html,
        '&lt;', '<'), '&gt;', '>'), '&quot;', '"'),
        '&#39;', ''''), '&nbsp;', ' '), '&amp;', '&'),
      '<[^>]+>', ' ', 'g')
WHERE source_key LIKE 'greenhouse:%'
  AND description_html LIKE '&lt;%';
```

Limited to `greenhouse:%` so we don't touch other adapters.

## Files touched
- `src/lib/sources/adapters.server.ts` — add `decodeHtmlEntities`, use in `fetchGreenhouse`
- `src/components/JobDescriptionDialog.tsx` — defensive decode before `sanitizeHtml`
- `supabase/migrations/<new>.sql` — one-shot backfill for existing Greenhouse rows

No schema, RLS, auth, or UI structure changes.
