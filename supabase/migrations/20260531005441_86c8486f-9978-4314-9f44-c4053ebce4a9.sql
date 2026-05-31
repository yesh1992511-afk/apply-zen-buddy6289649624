CREATE INDEX IF NOT EXISTS applications_worker_pickup_idx
  ON public.applications (user_id, phase, next_retry_at)
  WHERE phase = 'queued';

CREATE INDEX IF NOT EXISTS application_events_timeline_idx
  ON public.application_events (application_id, ts DESC);