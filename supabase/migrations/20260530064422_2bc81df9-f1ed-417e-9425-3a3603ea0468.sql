
-- 1. Cheaper default AI model for resume tailoring
ALTER TABLE public.automation_settings
  ALTER COLUMN ai_resume_model SET DEFAULT 'openai/gpt-4o-mini';
UPDATE public.automation_settings
  SET ai_resume_model = 'openai/gpt-4o-mini'
  WHERE ai_resume_model = 'openai/gpt-5';

-- 2. JD analysis cache (keyed by dedupe_hash of the JD)
CREATE TABLE public.jd_analysis_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dedupe_hash TEXT NOT NULL UNIQUE,
  model TEXT NOT NULL,
  analysis JSONB NOT NULL,
  tokens_in INTEGER,
  tokens_out INTEGER,
  cost_usd NUMERIC NOT NULL DEFAULT 0,
  hit_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_used_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX idx_jd_analysis_cache_hash ON public.jd_analysis_cache(dedupe_hash);
GRANT SELECT ON public.jd_analysis_cache TO authenticated;
GRANT ALL ON public.jd_analysis_cache TO service_role;
ALTER TABLE public.jd_analysis_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated reads cache"
  ON public.jd_analysis_cache FOR SELECT TO authenticated USING (true);

-- 3. Let owners insert their own usage_events (server-side worker uses service_role)
GRANT INSERT ON public.usage_events TO authenticated;
CREATE POLICY "owner inserts usage_events"
  ON public.usage_events FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_usage_events_user_created
  ON public.usage_events(user_id, created_at DESC);

-- 4. Helper to read MTD spend per provider (used by dashboard cost tile)
CREATE OR REPLACE FUNCTION public.usage_mtd_by_provider(_user_id UUID)
RETURNS TABLE(provider TEXT, total_cost NUMERIC, total_units NUMERIC, event_count BIGINT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT provider,
         COALESCE(SUM(cost_usd), 0) AS total_cost,
         COALESCE(SUM(units), 0) AS total_units,
         COUNT(*) AS event_count
  FROM public.usage_events
  WHERE user_id = _user_id
    AND created_at >= date_trunc('month', now())
  GROUP BY provider
  ORDER BY total_cost DESC;
$$;
GRANT EXECUTE ON FUNCTION public.usage_mtd_by_provider(UUID) TO authenticated;

-- 5. Schedule daily log retention (30 days)
CREATE EXTENSION IF NOT EXISTS pg_cron;
DO $$
BEGIN
  PERFORM cron.unschedule('purge-old-logs');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
SELECT cron.schedule(
  'purge-old-logs',
  '0 3 * * *',
  $$ DELETE FROM public.logs WHERE ts < now() - INTERVAL '30 days'; $$
);
