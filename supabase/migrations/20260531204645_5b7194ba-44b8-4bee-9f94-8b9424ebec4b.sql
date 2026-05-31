-- 1. Lock down jd_analysis_cache: remove blanket read policy, keep table service-role only
DROP POLICY IF EXISTS "authenticated reads cache" ON public.jd_analysis_cache;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.jd_analysis_cache FROM authenticated, anon;
GRANT ALL ON public.jd_analysis_cache TO service_role;

-- 2. Revoke EXECUTE on the SECURITY DEFINER rescore function from end-user roles
REVOKE EXECUTE ON FUNCTION public.rescore_all_jobs_for_user(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rescore_all_jobs_for_user(uuid) TO service_role;