
-- ============ enum extensions ============
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'admin';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'viewer';

DO $$ BEGIN
  CREATE TYPE public.application_phase AS ENUM (
    'discovered','scored','tailored','queued','applying','submitted',
    'needs_review','failed','follow_up_sent','replied','interview','offer','rejected'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ audit_log ============
CREATE TABLE IF NOT EXISTS public.audit_log (
  id BIGSERIAL PRIMARY KEY,
  ts TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id UUID,
  actor_role TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  before JSONB,
  after JSONB,
  ip TEXT,
  user_agent TEXT,
  request_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS audit_log_user_ts_idx ON public.audit_log(user_id, ts DESC);
CREATE INDEX IF NOT EXISTS audit_log_entity_idx ON public.audit_log(entity_type, entity_id);
GRANT SELECT, INSERT ON public.audit_log TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.audit_log_id_seq TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
GRANT ALL ON SEQUENCE public.audit_log_id_seq TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner reads own audit" ON public.audit_log FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "owner inserts own audit" ON public.audit_log FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
ALTER TABLE public.audit_log REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.audit_log;

-- ============ error_events ============
CREATE TABLE IF NOT EXISTS public.error_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  fingerprint TEXT NOT NULL,
  message TEXT NOT NULL,
  stack TEXT,
  source TEXT NOT NULL,
  route TEXT,
  count INTEGER NOT NULL DEFAULT 1,
  first_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (user_id, fingerprint)
);
CREATE INDEX IF NOT EXISTS error_events_user_last_idx ON public.error_events(user_id, last_seen DESC);
GRANT SELECT, INSERT, UPDATE ON public.error_events TO authenticated;
GRANT ALL ON public.error_events TO service_role;
ALTER TABLE public.error_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner full access" ON public.error_events FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
ALTER TABLE public.error_events REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.error_events;

-- ============ application_events ============
CREATE TABLE IF NOT EXISTS public.application_events (
  id BIGSERIAL PRIMARY KEY,
  ts TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id UUID NOT NULL,
  application_id UUID NOT NULL,
  phase public.application_phase NOT NULL,
  status TEXT,
  message TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  screenshot_path TEXT
);
CREATE INDEX IF NOT EXISTS app_events_app_ts_idx ON public.application_events(application_id, ts DESC);
CREATE INDEX IF NOT EXISTS app_events_user_ts_idx ON public.application_events(user_id, ts DESC);
GRANT SELECT, INSERT ON public.application_events TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.application_events_id_seq TO authenticated;
GRANT ALL ON public.application_events TO service_role;
GRANT ALL ON SEQUENCE public.application_events_id_seq TO service_role;
ALTER TABLE public.application_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner full access" ON public.application_events FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
ALTER TABLE public.application_events REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.application_events;

-- ============ feature_flags ============
CREATE TABLE IF NOT EXISTS public.feature_flags (
  key TEXT PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT false,
  rollout_pct INTEGER NOT NULL DEFAULT 0 CHECK (rollout_pct BETWEEN 0 AND 100),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.feature_flags TO authenticated;
GRANT ALL ON public.feature_flags TO service_role;
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone authed reads flags" ON public.feature_flags FOR SELECT TO authenticated USING (true);
-- Writes are admin-only and happen via service_role from server fns.

-- ============ billing scaffolding ============
CREATE TABLE IF NOT EXISTS public.plans (
  key TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  max_applies_per_day INTEGER NOT NULL DEFAULT 10,
  max_sources INTEGER NOT NULL DEFAULT 3,
  cookie_sync BOOLEAN NOT NULL DEFAULT false,
  admin_console BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true
);
GRANT SELECT ON public.plans TO authenticated;
GRANT ALL ON public.plans TO service_role;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone authed reads plans" ON public.plans FOR SELECT TO authenticated USING (active = true);

INSERT INTO public.plans (key, name, price_cents, max_applies_per_day, max_sources, cookie_sync, admin_console, sort_order) VALUES
  ('free','Free',0,10,3,false,false,1),
  ('pro','Pro',1900,100,20,true,false,2),
  ('team','Team',4900,500,100,true,true,3)
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.subscriptions (
  user_id UUID PRIMARY KEY,
  plan_key TEXT NOT NULL REFERENCES public.plans(key),
  status TEXT NOT NULL DEFAULT 'trialing',
  trial_ends_at TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at TIMESTAMPTZ,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner reads sub" ON public.subscriptions FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.usage_quotas (
  user_id UUID NOT NULL,
  day DATE NOT NULL,
  applies_count INTEGER NOT NULL DEFAULT 0,
  ai_tokens INTEGER NOT NULL DEFAULT 0,
  captures_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);
GRANT SELECT, INSERT, UPDATE ON public.usage_quotas TO authenticated;
GRANT ALL ON public.usage_quotas TO service_role;
ALTER TABLE public.usage_quotas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner full quota" ON public.usage_quotas FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============ account_deletion_requests (GDPR) ============
CREATE TABLE IF NOT EXISTS public.account_deletion_requests (
  user_id UUID PRIMARY KEY,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  purge_after TIMESTAMPTZ NOT NULL DEFAULT now() + interval '30 days',
  cancelled_at TIMESTAMPTZ,
  reason TEXT
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.account_deletion_requests TO authenticated;
GRANT ALL ON public.account_deletion_requests TO service_role;
ALTER TABLE public.account_deletion_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner full deletion" ON public.account_deletion_requests FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============ column additions ============
ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS phase public.application_phase NOT NULL DEFAULT 'discovered',
  ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS dlq_reason TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS applications_idem_uidx ON public.applications(user_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS applications_phase_idx ON public.applications(user_id, phase);

ALTER TABLE public.notification_log
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS notification_log_idem_uidx ON public.notification_log(user_id, idempotency_key) WHERE idempotency_key IS NOT NULL;

ALTER TABLE public.session_cookies
  ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS decrypt_failures INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.extension_tokens
  ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;

ALTER TABLE public.profile
  ADD COLUMN IF NOT EXISTS onboarding_state JSONB NOT NULL DEFAULT '{}'::jsonb;

-- ============ helpers ============
CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS subscriptions_touch ON public.subscriptions;
CREATE TRIGGER subscriptions_touch BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Seed a free subscription for the existing owner
INSERT INTO public.subscriptions (user_id, plan_key, status, trial_ends_at)
SELECT id, 'pro', 'trialing', now() + interval '14 days' FROM auth.users
ON CONFLICT (user_id) DO NOTHING;
