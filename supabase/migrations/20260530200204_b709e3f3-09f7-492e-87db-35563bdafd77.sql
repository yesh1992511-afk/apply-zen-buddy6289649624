REVOKE EXECUTE ON FUNCTION public.current_plan_for(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_source_quota() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_apply_quota() FROM PUBLIC, anon, authenticated;