
-- Hot-path indexes
CREATE INDEX IF NOT EXISTS idx_jobs_user_status_posted
  ON public.jobs (user_id, status, posted_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_jobs_user_matched_score
  ON public.jobs (user_id, matched, score DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_user_dedupe
  ON public.jobs (user_id, dedupe_hash);
CREATE INDEX IF NOT EXISTS idx_applications_user_created
  ON public.applications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_applications_user_status
  ON public.applications (user_id, status);
CREATE INDEX IF NOT EXISTS idx_applications_user_job
  ON public.applications (user_id, job_id);
CREATE INDEX IF NOT EXISTS idx_applications_failed
  ON public.applications (user_id, updated_at DESC) WHERE status = 'failed';
CREATE INDEX IF NOT EXISTS idx_applications_needs_review
  ON public.applications (user_id, updated_at DESC) WHERE status = 'needs_review';
CREATE INDEX IF NOT EXISTS idx_app_events_app_ts
  ON public.application_events (application_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_usage_events_user_created
  ON public.usage_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sources_user_lastrun
  ON public.sources (user_id, last_run_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_logs_user_ts
  ON public.logs (user_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_notification_log_user_created
  ON public.notification_log (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_ts
  ON public.audit_log (user_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_worker_commands_user_created
  ON public.worker_commands (user_id, created_at DESC);

-- Worker idempotency
CREATE TABLE IF NOT EXISTS public.worker_invocations (
  idempotency_key text PRIMARY KEY,
  kind text NOT NULL,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.worker_invocations TO authenticated;
GRANT ALL ON public.worker_invocations TO service_role;
ALTER TABLE public.worker_invocations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owner reads own invocations" ON public.worker_invocations;
CREATE POLICY "owner reads own invocations" ON public.worker_invocations
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_worker_invocations_created
  ON public.worker_invocations (created_at DESC);

CREATE OR REPLACE FUNCTION public.prune_worker_invocations()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM public.worker_invocations WHERE created_at < now() - interval '24 hours';
$$;
