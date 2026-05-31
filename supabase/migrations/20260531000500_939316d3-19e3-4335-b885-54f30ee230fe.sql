
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS score_breakdown jsonb;

CREATE INDEX IF NOT EXISTS idx_jobs_user_matched_score
  ON public.jobs (user_id, matched, score DESC, posted_at DESC NULLS LAST);

CREATE UNIQUE INDEX IF NOT EXISTS uq_applications_user_job_active
  ON public.applications (user_id, job_id)
  WHERE phase IS DISTINCT FROM 'dead_letter';

CREATE OR REPLACE FUNCTION public.match_job_to_filters(_job_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  j RECORD;
  f RECORD;
  s RECORD;
  best_score INTEGER := 0;
  matched_ids uuid[] := ARRAY[]::uuid[];
  kw TEXT;
  title_l TEXT;
  hay TEXT;
  loc_l TEXT;
  target_title_hits INTEGER := 0;
  target_exclude_hit BOOLEAN := FALSE;
  country_ok BOOLEAN := TRUE;
  breakdown jsonb := '{}'::jsonb;
BEGIN
  SELECT * INTO j FROM public.jobs WHERE id = _job_id;
  IF NOT FOUND THEN RETURN; END IF;

  title_l := lower(coalesce(j.title,''));
  hay := lower(coalesce(j.title,'') || ' ' || coalesce(j.company,'') || ' ' || coalesce(j.description,'') || ' ' || coalesce(j.location,''));
  loc_l := lower(coalesce(j.location,''));

  SELECT target_titles, target_country, target_exclude_keywords, target_locations
    INTO s
    FROM public.automation_settings
   WHERE user_id = j.user_id;

  IF s.target_exclude_keywords IS NOT NULL THEN
    FOREACH kw IN ARRAY s.target_exclude_keywords LOOP
      IF kw <> '' AND position(lower(kw) IN hay) > 0 THEN
        target_exclude_hit := TRUE; EXIT;
      END IF;
    END LOOP;
  END IF;

  IF s.target_country = 'US' AND loc_l <> '' THEN
    IF position('united states' IN loc_l) = 0
       AND position(' usa' IN ' '||loc_l) = 0
       AND position(', us' IN loc_l) = 0
       AND position('remote' IN loc_l) = 0
       AND position('anywhere' IN loc_l) = 0 THEN
      IF loc_l !~ '\m(alabama|alaska|arizona|arkansas|california|colorado|connecticut|delaware|florida|georgia|hawaii|idaho|illinois|indiana|iowa|kansas|kentucky|louisiana|maine|maryland|massachusetts|michigan|minnesota|mississippi|missouri|montana|nebraska|nevada|new hampshire|new jersey|new mexico|new york|north carolina|north dakota|ohio|oklahoma|oregon|pennsylvania|rhode island|south carolina|south dakota|tennessee|texas|utah|vermont|virginia|washington|west virginia|wisconsin|wyoming)\M' THEN
        country_ok := FALSE;
      END IF;
    END IF;
  END IF;

  IF s.target_titles IS NOT NULL THEN
    FOREACH kw IN ARRAY s.target_titles LOOP
      IF kw <> '' AND position(lower(kw) IN title_l) > 0 THEN
        target_title_hits := target_title_hits + 1;
      END IF;
    END LOOP;
  END IF;

  FOR f IN SELECT * FROM public.filters WHERE user_id = j.user_id LOOP
    DECLARE
      score INTEGER := 50;
      keep BOOLEAN := TRUE;
      title_kw_hits INTEGER := 0;
      body_kw_hits INTEGER := 0;
      bd jsonb;
    BEGIN
      IF target_exclude_hit THEN keep := FALSE; END IF;
      IF NOT country_ok THEN keep := FALSE; END IF;

      IF keep AND f.exclude_keywords IS NOT NULL THEN
        FOREACH kw IN ARRAY f.exclude_keywords LOOP
          IF kw <> '' AND position(lower(kw) IN hay) > 0 THEN
            keep := FALSE; EXIT;
          END IF;
        END LOOP;
      END IF;

      IF keep AND f.exclude_companies IS NOT NULL THEN
        FOREACH kw IN ARRAY f.exclude_companies LOOP
          IF kw <> '' AND lower(kw) = lower(coalesce(j.company,'')) THEN
            keep := FALSE; EXIT;
          END IF;
        END LOOP;
      END IF;

      IF keep AND f.keywords IS NOT NULL THEN
        FOREACH kw IN ARRAY f.keywords LOOP
          IF kw = '' THEN CONTINUE; END IF;
          IF position(lower(kw) IN title_l) > 0 THEN
            title_kw_hits := title_kw_hits + 1;
          ELSIF position(lower(kw) IN hay) > 0 THEN
            body_kw_hits := body_kw_hits + 1;
          END IF;
        END LOOP;
        score := score + LEAST(50, title_kw_hits * 15) + LEAST(20, body_kw_hits * 4);
      END IF;

      IF keep AND target_title_hits > 0 THEN
        score := score + LEAST(25, target_title_hits * 12);
      END IF;

      IF keep AND f.salary_min IS NOT NULL AND j.salary_min IS NOT NULL AND j.salary_min < f.salary_min THEN
        score := score - 20;
      END IF;

      IF keep AND f.posted_within_hours IS NOT NULL AND j.posted_at IS NOT NULL THEN
        IF j.posted_at < (now() - (f.posted_within_hours || ' hours')::interval) THEN
          keep := FALSE;
        END IF;
      END IF;

      IF score > 100 THEN score := 100; END IF;
      IF score < 0   THEN score := 0;   END IF;

      bd := jsonb_build_object(
        'filter_id', f.id,
        'filter_name', f.name,
        'kept', keep,
        'excluded_by_target', target_exclude_hit,
        'country_ok', country_ok,
        'target_title_hits', target_title_hits,
        'filter_title_hits', title_kw_hits,
        'filter_body_hits', body_kw_hits,
        'final_score', score
      );

      IF keep AND score >= coalesce(f.min_score, 40) THEN
        matched_ids := array_append(matched_ids, f.id);
        IF score > best_score THEN
          best_score := score;
          breakdown := bd;
        END IF;
      ELSIF breakdown = '{}'::jsonb THEN
        breakdown := bd;
      END IF;
    END;
  END LOOP;

  UPDATE public.jobs
     SET score = best_score,
         matched = (array_length(matched_ids,1) > 0),
         matched_filter_ids = matched_ids,
         score_breakdown = breakdown,
         status = CASE WHEN array_length(matched_ids,1) > 0 THEN 'matched' ELSE 'discarded' END
   WHERE id = _job_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.rescore_all_jobs_for_user(_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  r RECORD;
  n INTEGER := 0;
BEGIN
  IF _user_id <> auth.uid() AND NOT (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'not allowed';
  END IF;
  FOR r IN SELECT id FROM public.jobs WHERE user_id = _user_id LOOP
    PERFORM public.match_job_to_filters(r.id);
    n := n + 1;
  END LOOP;
  RETURN n;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rescore_all_jobs_for_user(uuid) TO authenticated;
