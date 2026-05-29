
-- 1. Gmail credentials (one row per user)
CREATE TABLE public.gmail_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  email text NOT NULL,
  app_password text NOT NULL,
  imap_host text NOT NULL DEFAULT 'imap.gmail.com',
  imap_port integer NOT NULL DEFAULT 993,
  smtp_host text NOT NULL DEFAULT 'smtp.gmail.com',
  smtp_port integer NOT NULL DEFAULT 465,
  verified_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gmail_credentials TO authenticated;
GRANT ALL ON public.gmail_credentials TO service_role;
ALTER TABLE public.gmail_credentials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner full access" ON public.gmail_credentials
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER tr_gmail_creds_updated BEFORE UPDATE ON public.gmail_credentials
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. Notification settings
CREATE TABLE public.notification_settings (
  user_id uuid PRIMARY KEY,
  recipient_email text,
  notify_manual_review boolean NOT NULL DEFAULT true,
  notify_high_score boolean NOT NULL DEFAULT true,
  high_score_threshold integer NOT NULL DEFAULT 95,
  notify_apply_failed boolean NOT NULL DEFAULT true,
  notify_worker_offline boolean NOT NULL DEFAULT true,
  daily_summary_enabled boolean NOT NULL DEFAULT true,
  daily_summary_time time NOT NULL DEFAULT '20:00:00',
  last_daily_summary_date date,
  last_worker_offline_alert timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_settings TO authenticated;
GRANT ALL ON public.notification_settings TO service_role;
ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner full access" ON public.notification_settings
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER tr_notif_settings_updated BEFORE UPDATE ON public.notification_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. Notification log (audit trail + debouncing)
CREATE TABLE public.notification_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL,
  subject text NOT NULL,
  body text,
  recipient_email text NOT NULL,
  status text NOT NULL DEFAULT 'sent',
  last_error text,
  job_id uuid,
  application_id uuid,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_log TO authenticated;
GRANT ALL ON public.notification_log TO service_role;
ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner full access" ON public.notification_log
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX idx_notif_log_user_kind_time ON public.notification_log(user_id, kind, created_at DESC);

-- 4. Update signup trigger to seed notification_settings
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'owner') ON CONFLICT DO NOTHING;
  INSERT INTO public.profile (user_id, email) VALUES (NEW.id, NEW.email) ON CONFLICT DO NOTHING;
  INSERT INTO public.automation_settings (user_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  INSERT INTO public.notification_settings (user_id, recipient_email) VALUES (NEW.id, NEW.email) ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;

-- Backfill for existing users
INSERT INTO public.notification_settings (user_id, recipient_email)
SELECT u.id, u.email FROM auth.users u
ON CONFLICT DO NOTHING;

-- 5. pg_cron jobs (heartbeat watchdog + daily-summary dispatcher)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.unschedule('jobpilot-heartbeat-check') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'jobpilot-heartbeat-check'
);
SELECT cron.unschedule('jobpilot-daily-summary-tick') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'jobpilot-daily-summary-tick'
);

SELECT cron.schedule(
  'jobpilot-heartbeat-check',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--ba5780a8-641e-4ee8-9c24-6e1c185cef2f.lovable.app/api/public/hooks/check-heartbeat',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlhcmZlYm5ubm9zd3ltZ2Z2bmVsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwNzg5MDQsImV4cCI6MjA5NTY1NDkwNH0.kG3ZJ14siCHKeiogunWG9840YH6ovHXMlOHwNjzglZE"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

SELECT cron.schedule(
  'jobpilot-daily-summary-tick',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--ba5780a8-641e-4ee8-9c24-6e1c185cef2f.lovable.app/api/public/hooks/daily-summary',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlhcmZlYm5ubm9zd3ltZ2Z2bmVsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwNzg5MDQsImV4cCI6MjA5NTY1NDkwNH0.kG3ZJ14siCHKeiogunWG9840YH6ovHXMlOHwNjzglZE"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
