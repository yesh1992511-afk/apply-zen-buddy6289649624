
-- Make the helper run as the calling user; RLS on usage_events already restricts to owner.
CREATE OR REPLACE FUNCTION public.usage_mtd_by_provider(_user_id UUID)
RETURNS TABLE(provider TEXT, total_cost NUMERIC, total_units NUMERIC, event_count BIGINT)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT provider,
         COALESCE(SUM(cost_usd), 0) AS total_cost,
         COALESCE(SUM(units), 0) AS total_units,
         COUNT(*) AS event_count
  FROM public.usage_events
  WHERE user_id = _user_id
    AND user_id = auth.uid()
    AND created_at >= date_trunc('month', now())
  GROUP BY provider
  ORDER BY total_cost DESC;
$$;
REVOKE EXECUTE ON FUNCTION public.usage_mtd_by_provider(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.usage_mtd_by_provider(UUID) TO authenticated;
