-- 1. Normalize legacy 'succeeded' run-status values to 'success'
UPDATE public.sources SET last_run_status = 'success' WHERE last_run_status = 'succeeded';

-- 2. Drop underscore-keyed apify rows when a colon-keyed sibling already exists
DELETE FROM public.sources u
USING public.sources c
WHERE u.user_id = c.user_id
  AND u.key LIKE 'apify\_%' ESCAPE '\'
  AND c.key = replace(u.key, 'apify_', 'apify:');

-- 3. Rename remaining apify_* rows to apify:*
UPDATE public.sources
   SET key = replace(key, 'apify_', 'apify:')
 WHERE key LIKE 'apify\_%' ESCAPE '\';

-- 4. Collapse usajobs:* sub-rows into a single 'usajobs' source per user
WITH subs AS (
  SELECT user_id,
         array_agg(split_part(key, ':', 2) ORDER BY key) AS queries,
         bool_or(enabled) AS enabled,
         max(cadence_minutes) AS cadence_minutes,
         max(last_run_at) AS last_run_at,
         sum(coalesce(last_run_count, 0))::int AS last_run_count
    FROM public.sources
   WHERE key LIKE 'usajobs:%'
   GROUP BY user_id
)
INSERT INTO public.sources (
  user_id, key, display_name, kind, enabled, cadence_minutes, config,
  last_run_at, last_run_status, last_run_count
)
SELECT s.user_id, 'usajobs', 'USAJobs (federal, free)', 'rest'::source_kind,
       s.enabled, s.cadence_minutes,
       jsonb_build_object('queries', to_jsonb(s.queries)),
       s.last_run_at, 'success'::run_status, s.last_run_count
  FROM subs s
ON CONFLICT (user_id, key) DO UPDATE
   SET enabled = public.sources.enabled OR EXCLUDED.enabled,
       cadence_minutes = GREATEST(public.sources.cadence_minutes, EXCLUDED.cadence_minutes),
       config = public.sources.config
                || jsonb_build_object(
                     'queries',
                     coalesce(public.sources.config->'queries', '[]'::jsonb)
                     || (EXCLUDED.config->'queries')
                   ),
       last_run_at = GREATEST(public.sources.last_run_at, EXCLUDED.last_run_at);

DELETE FROM public.sources WHERE key LIKE 'usajobs:%';

-- 5. Same collapse for greenhouse:<company> rows -> greenhouse_boards.companies[]
WITH ghs AS (
  SELECT user_id,
         array_agg(split_part(key, ':', 2) ORDER BY key) AS companies,
         bool_or(enabled) AS enabled,
         max(cadence_minutes) AS cadence_minutes,
         max(last_run_at) AS last_run_at,
         sum(coalesce(last_run_count, 0))::int AS last_run_count
    FROM public.sources
   WHERE key LIKE 'greenhouse:%'
   GROUP BY user_id
)
INSERT INTO public.sources (
  user_id, key, display_name, kind, enabled, cadence_minutes, config,
  last_run_at, last_run_status, last_run_count
)
SELECT g.user_id, 'greenhouse_boards', 'Greenhouse boards', 'board'::source_kind,
       g.enabled, g.cadence_minutes,
       jsonb_build_object('companies', to_jsonb(g.companies)),
       g.last_run_at, 'success'::run_status, g.last_run_count
  FROM ghs g
ON CONFLICT (user_id, key) DO UPDATE
   SET enabled = public.sources.enabled OR EXCLUDED.enabled,
       cadence_minutes = GREATEST(public.sources.cadence_minutes, EXCLUDED.cadence_minutes),
       config = public.sources.config
                || jsonb_build_object(
                     'companies',
                     coalesce(public.sources.config->'companies', '[]'::jsonb)
                     || (EXCLUDED.config->'companies')
                   ),
       last_run_at = GREATEST(public.sources.last_run_at, EXCLUDED.last_run_at);

DELETE FROM public.sources WHERE key LIKE 'greenhouse:%';
