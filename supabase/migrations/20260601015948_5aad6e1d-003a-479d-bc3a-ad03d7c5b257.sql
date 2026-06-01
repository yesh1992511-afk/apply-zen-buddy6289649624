
CREATE OR REPLACE FUNCTION public.match_job_to_filters(_job_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  j RECORD;
  f RECORD;
  s RECORD;
  best_score INTEGER := 0;
  matched_ids uuid[] := ARRAY[]::uuid[];
  kw TEXT;
  kw_re TEXT;
  title_l TEXT;
  hay TEXT;
  loc_l TEXT;
  target_title_hits INTEGER := 0;
  target_exclude_hit BOOLEAN := FALSE;
  country_ok BOOLEAN := TRUE;
  language_ok BOOLEAN := TRUE;
  breakdown jsonb := '{}'::jsonb;
BEGIN
  SELECT * INTO j FROM public.jobs WHERE id = _job_id;
  IF NOT FOUND THEN RETURN; END IF;

  title_l := lower(coalesce(j.title,''));
  hay := lower(coalesce(j.title,'') || ' ' || coalesce(j.company,'') || ' ' || coalesce(j.description,'') || ' ' || coalesce(j.location,''));
  loc_l := lower(coalesce(j.location,''));

  IF coalesce(j.title,'') ~ '[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af\u0400-\u04ff\u0600-\u06ff]' THEN
    language_ok := FALSE;
  END IF;

  SELECT target_titles, target_country, target_exclude_keywords, target_locations
    INTO s
    FROM public.automation_settings
   WHERE user_id = j.user_id;

  -- Whole-word/phrase exclude (target level). Fixes "intern" matching "internal".
  IF s.target_exclude_keywords IS NOT NULL THEN
    FOREACH kw IN ARRAY s.target_exclude_keywords LOOP
      IF kw <> '' THEN
        kw_re := '\m' || regexp_replace(lower(kw), '([.*+?^${}()|\[\]\\])', '\\\1', 'g') || '\M';
        IF hay ~ kw_re THEN
          target_exclude_hit := TRUE; EXIT;
        END IF;
      END IF;
    END LOOP;
  END IF;

  IF s.target_country = 'US' AND loc_l <> '' THEN
    IF position('united states' IN loc_l) = 0
       AND position(' usa' IN ' '||loc_l) = 0
       AND position(', us' IN loc_l) = 0
       AND loc_l !~ '\m(us|usa)\M'
       AND position('remote' IN loc_l) = 0
       AND position('anywhere' IN loc_l) = 0 THEN
      IF loc_l !~ '\m(alabama|alaska|arizona|arkansas|california|colorado|connecticut|delaware|florida|georgia|hawaii|idaho|illinois|indiana|iowa|kansas|kentucky|louisiana|maine|maryland|massachusetts|michigan|minnesota|mississippi|missouri|montana|nebraska|nevada|new hampshire|new jersey|new mexico|new york|north carolina|north dakota|ohio|oklahoma|oregon|pennsylvania|rhode island|south carolina|south dakota|tennessee|texas|utah|vermont|virginia|washington|west virginia|wisconsin|wyoming)\M' THEN
        IF loc_l ~ '\m(india|pakistan|bangladesh|philippines|indonesia|vietnam|thailand|malaysia|singapore|china|japan|korea|hong kong|taiwan|united kingdom|uk|england|scotland|ireland|france|germany|spain|italy|portugal|netherlands|belgium|sweden|norway|finland|denmark|poland|romania|ukraine|russia|turkey|israel|egypt|nigeria|kenya|south africa|brazil|argentina|chile|colombia|mexico|peru|canada|australia|new zealand|uae|saudi|qatar|bahrain|bosnia|serbia|croatia|greece|czech|hungary|slovakia|bulgaria|austria|switzerland)\M' THEN
          country_ok := FALSE;
        END IF;
      END IF;
    END IF;
  END IF;

  IF s.target_titles IS NOT NULL THEN
    FOREACH kw IN ARRAY s.target_titles LOOP
      IF kw <> '' THEN
        kw_re := '\m' || regexp_replace(lower(kw), '([.*+?^${}()|\[\]\\])', '\\\1', 'g') || '\M';
        IF title_l ~ kw_re THEN
          target_title_hits := target_title_hits + 1;
        END IF;
      END IF;
    END LOOP;
  END IF;

  FOR f IN SELECT * FROM public.filters WHERE user_id = j.user_id LOOP
    DECLARE
      score INTEGER := 0;
      keep BOOLEAN := TRUE;
      title_kw_hits INTEGER := 0;
      body_kw_hits INTEGER := 0;
      is_cyber_filter BOOLEAN := FALSE;
      bd jsonb;
    BEGIN
      is_cyber_filter := lower(coalesce(f.name,'')) LIKE '%cyber%'
                      OR lower(coalesce(f.name,'')) LIKE '%security%'
                      OR lower(coalesce(f.name,'')) LIKE '%infosec%';

      IF target_exclude_hit THEN keep := FALSE; END IF;
      IF NOT country_ok THEN keep := FALSE; END IF;
      IF NOT language_ok THEN keep := FALSE; END IF;

      -- Whole-word/phrase filter-level exclude
      IF keep AND f.exclude_keywords IS NOT NULL THEN
        FOREACH kw IN ARRAY f.exclude_keywords LOOP
          IF kw <> '' THEN
            kw_re := '\m' || regexp_replace(lower(kw), '([.*+?^${}()|\[\]\\])', '\\\1', 'g') || '\M';
            IF hay ~ kw_re THEN
              keep := FALSE; EXIT;
            END IF;
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

      -- Whole-word/phrase include keyword hits
      IF keep AND f.keywords IS NOT NULL THEN
        FOREACH kw IN ARRAY f.keywords LOOP
          IF kw = '' THEN CONTINUE; END IF;
          kw_re := '\m' || regexp_replace(lower(kw), '([.*+?^${}()|\[\]\\])', '\\\1', 'g') || '\M';
          IF title_l ~ kw_re THEN
            title_kw_hits := title_kw_hits + 1;
          ELSIF hay ~ kw_re THEN
            body_kw_hits := body_kw_hits + 1;
          END IF;
        END LOOP;
        score := score + LEAST(70, title_kw_hits * 25) + LEAST(30, body_kw_hits * 5);
      END IF;

      IF keep AND is_cyber_filter AND title_kw_hits = 0 AND body_kw_hits < 2 THEN
        keep := FALSE;
      END IF;

      IF keep AND title_kw_hits = 0 AND body_kw_hits = 0 THEN
        keep := FALSE;
      END IF;

      IF keep AND target_title_hits > 0 THEN
        score := score + LEAST(15, target_title_hits * 8);
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
        'language_ok', language_ok,
        'is_cyber_filter', is_cyber_filter,
        'target_title_hits', target_title_hits,
        'filter_title_hits', title_kw_hits,
        'filter_body_hits', body_kw_hits,
        'final_score', score
      );

      IF keep AND score >= coalesce(f.min_score, 55) THEN
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
$function$;
