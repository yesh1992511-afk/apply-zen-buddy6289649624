
REVOKE EXECUTE ON FUNCTION public.prune_worker_invocations() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prune_worker_invocations() TO service_role;
