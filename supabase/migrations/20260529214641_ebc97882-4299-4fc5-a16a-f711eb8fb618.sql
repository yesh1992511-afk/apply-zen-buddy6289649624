
-- Worker command bus: UI queues commands, worker polls every 5s.
CREATE TABLE public.worker_commands (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('scrape','apply','tailor','deploy_self_test','rebuild_index')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','done','failed')),
  result JSONB,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.worker_commands TO authenticated;
GRANT ALL ON public.worker_commands TO service_role;

ALTER TABLE public.worker_commands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner full access" ON public.worker_commands
  FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE INDEX idx_worker_commands_pending ON public.worker_commands (user_id, status, created_at)
  WHERE status = 'pending';

-- Cost tracker for Apify / OpenAI / DeepSeek usage
CREATE TABLE public.usage_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  provider TEXT NOT NULL,
  kind TEXT NOT NULL,
  units NUMERIC NOT NULL DEFAULT 0,
  cost_usd NUMERIC NOT NULL DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.usage_events TO authenticated;
GRANT ALL ON public.usage_events TO service_role;

ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner reads" ON public.usage_events
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE INDEX idx_usage_events_user_time ON public.usage_events (user_id, created_at DESC);

-- Enable realtime on logs + worker_commands + worker_heartbeat
ALTER PUBLICATION supabase_realtime ADD TABLE public.logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.worker_commands;
ALTER PUBLICATION supabase_realtime ADD TABLE public.worker_heartbeat;
ALTER PUBLICATION supabase_realtime ADD TABLE public.applications;
