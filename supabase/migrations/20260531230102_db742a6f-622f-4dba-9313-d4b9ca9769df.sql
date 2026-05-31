REVOKE ALL ON public.jd_analysis_cache FROM anon, authenticated;
GRANT ALL ON public.jd_analysis_cache TO service_role;

DROP POLICY IF EXISTS "Service role manages AI cache" ON public.jd_analysis_cache;
CREATE POLICY "Service role manages AI cache"
ON public.jd_analysis_cache
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);