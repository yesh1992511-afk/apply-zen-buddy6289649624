-- Phase 2: dedup and matching infrastructure

-- 1. Unique dedup hash per user (idempotent upserts from multiple sources)
ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_dedupe_hash_unique;
ALTER TABLE public.jobs ADD CONSTRAINT jobs_dedupe_hash_unique UNIQUE (user_id, dedupe_hash);

-- 2. Index for dashboard "matched, top score" queries
CREATE INDEX IF NOT EXISTS jobs_status_score_idx ON public.jobs (user_id, status, score DESC, posted_at DESC);
CREATE INDEX IF NOT EXISTS jobs_recent_idx ON public.jobs (user_id, scraped_at DESC);

-- 3. Filter-matching function
CREATE OR REPLACE FUNCTION public.match_job_to_filters(_job_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  j RECORD;
  f RECORD;
  s INTEGER := 0;
  matched_ids uuid[] := ARRAY[]::uuid[];
  kw TEXT;
  hay TEXT;
BEGIN
  SELECT * INTO j FROM public.jobs WHERE id = _job_id;
  IF NOT FOUND THEN RETURN; END IF;

  hay := lower(coalesce(j.title,'') || ' ' || coalesce(j.company,'') || ' ' || coalesce(j.description,'') || ' ' || coalesce(j.location,''));

  FOR f IN SELECT * FROM public.filters WHERE user_id = j.user_id LOOP
    DECLARE
      score INTEGER := 50;
      keep BOOLEAN := TRUE;
    BEGIN
      -- exclude keywords
      IF f.exclude_keywords IS NOT NULL THEN
        FOREACH kw IN ARRAY f.exclude_keywords LOOP
          IF kw <> '' AND position(lower(kw) IN hay) > 0 THEN keep := FALSE; EXIT; END IF;
        END LOOP;
      END IF;
      -- exclude companies
      IF keep AND f.exclude_companies IS NOT NULL THEN
        FOREACH kw IN ARRAY f.exclude_companies LOOP
          IF kw <> '' AND lower(kw) = lower(coalesce(j.company,'')) THEN keep := FALSE; EXIT; END IF;
        END LOOP;
      END IF;
      -- keyword bonus
      IF keep AND f.keywords IS NOT NULL THEN
        FOREACH kw IN ARRAY f.keywords LOOP
          IF kw <> '' AND position(lower(kw) IN hay) > 0 THEN score := score + 10; END IF;
        END LOOP;
      END IF;
      -- salary
      IF keep AND f.salary_min IS NOT NULL AND j.salary_min IS NOT NULL AND j.salary_min < f.salary_min THEN
        score := score - 20;
      END IF;
      -- recency
      IF keep AND f.posted_within_hours IS NOT NULL AND j.posted_at IS NOT NULL THEN
        IF j.posted_at < (now() - (f.posted_within_hours || ' hours')::interval) THEN keep := FALSE; END IF;
      END IF;

      IF score > 100 THEN score := 100; END IF;
      IF score < 0 THEN score := 0; END IF;

      IF keep AND score >= coalesce(f.min_score, 40) THEN
        matched_ids := array_append(matched_ids, f.id);
        IF score > s THEN s := score; END IF;
      END IF;
    END;
  END LOOP;

  UPDATE public.jobs
  SET score = s,
      matched = (array_length(matched_ids,1) > 0),
      matched_filter_ids = matched_ids,
      status = CASE WHEN array_length(matched_ids,1) > 0 THEN 'matched' ELSE 'discarded' END
  WHERE id = _job_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.match_job_to_filters(uuid) TO authenticated, service_role;

-- 4. Enable realtime for jobs feed on dashboard
ALTER PUBLICATION supabase_realtime ADD TABLE public.jobs;