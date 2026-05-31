
REVOKE ALL ON FUNCTION public.auto_queue_matched_job() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auto_queue_matched_job() TO service_role;
