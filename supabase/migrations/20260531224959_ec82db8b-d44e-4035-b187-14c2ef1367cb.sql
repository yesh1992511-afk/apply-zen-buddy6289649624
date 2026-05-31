DELETE FROM public.jobs
 WHERE matched = false
   AND id NOT IN (SELECT job_id FROM public.applications WHERE job_id IS NOT NULL);

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.jobs LOOP
    PERFORM public.match_job_to_filters(r.id);
  END LOOP;
END $$;