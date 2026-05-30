-- 1. Realtime: add sources, ensure full row payloads
ALTER PUBLICATION supabase_realtime ADD TABLE public.sources;
ALTER TABLE public.sources REPLICA IDENTITY FULL;
ALTER TABLE public.logs REPLICA IDENTITY FULL;
ALTER TABLE public.worker_commands REPLICA IDENTITY FULL;
ALTER TABLE public.worker_heartbeat REPLICA IDENTITY FULL;
ALTER TABLE public.applications REPLICA IDENTITY FULL;
ALTER TABLE public.jobs REPLICA IDENTITY FULL;

-- 2. session_cookies (extension → worker cookie pipe; ciphertext only)
CREATE TABLE public.session_cookies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  host text NOT NULL,
  ciphertext text NOT NULL,
  iv text NOT NULL,
  expires_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, host)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.session_cookies TO authenticated;
GRANT ALL ON public.session_cookies TO service_role;

ALTER TABLE public.session_cookies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner full access"
  ON public.session_cookies
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER session_cookies_updated_at
  BEFORE UPDATE ON public.session_cookies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.session_cookies;
ALTER TABLE public.session_cookies REPLICA IDENTITY FULL;

-- 3. Index for live worker dot
CREATE INDEX IF NOT EXISTS idx_worker_heartbeat_user_last_seen
  ON public.worker_heartbeat (user_id, last_seen DESC);