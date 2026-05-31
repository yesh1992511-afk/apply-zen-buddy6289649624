CREATE OR REPLACE FUNCTION public.bootstrap_apply_worker_cron(_secret text, _base_url text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, cron, vault
AS $$
DECLARE
  v_secret_id uuid;
  v_jobid bigint;
  v_unscheduled int := 0;
  r record;
BEGIN
  IF _secret IS NULL OR length(_secret) < 16 THEN
    RAISE EXCEPTION 'secret too short';
  END IF;

  -- Upsert into Vault
  SELECT id INTO v_secret_id FROM vault.secrets WHERE name = 'worker_cron_secret';
  IF v_secret_id IS NULL THEN
    v_secret_id := vault.create_secret(_secret, 'worker_cron_secret', 'Shared secret for /api/public/hooks/* cron callers');
  ELSE
    PERFORM vault.update_secret(v_secret_id, _secret, 'worker_cron_secret', 'Shared secret for /api/public/hooks/* cron callers');
  END IF;

  -- Unschedule any existing apply-worker jobs
  FOR r IN SELECT jobid, jobname FROM cron.job WHERE command ILIKE '%apply-worker%' OR jobname ILIKE '%apply-worker%' LOOP
    PERFORM cron.unschedule(r.jobid);
    v_unscheduled := v_unscheduled + 1;
  END LOOP;

  -- Schedule fresh every minute using Vault-resolved secret
  v_jobid := cron.schedule(
    'apply-worker-every-minute',
    '* * * * *',
    format($cmd$
      SELECT net.http_post(
        url     := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-internal-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'worker_cron_secret')
        ),
        body    := '{}'::jsonb
      );
    $cmd$, _base_url || '/api/public/hooks/apply-worker')
  );

  RETURN jsonb_build_object('jobid', v_jobid, 'unscheduled', v_unscheduled, 'vault_id', v_secret_id);
END $$;

REVOKE ALL ON FUNCTION public.bootstrap_apply_worker_cron(text, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bootstrap_apply_worker_cron(text, text) TO service_role;