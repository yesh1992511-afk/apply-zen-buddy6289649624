-- Schedule daily prune of worker_invocations dedupe table
SELECT cron.schedule(
  'prune-worker-invocations-daily',
  '17 3 * * *',
  $$SELECT public.prune_worker_invocations();$$
)
WHERE NOT EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'prune-worker-invocations-daily'
);