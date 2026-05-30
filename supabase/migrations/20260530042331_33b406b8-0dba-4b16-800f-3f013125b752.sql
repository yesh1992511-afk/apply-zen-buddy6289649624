REVOKE EXECUTE ON FUNCTION public.match_job_to_filters(uuid) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.match_job_to_filters(uuid) TO service_role;