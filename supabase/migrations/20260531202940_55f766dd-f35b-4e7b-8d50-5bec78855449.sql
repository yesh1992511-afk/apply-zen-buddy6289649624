-- Re-schedule pg_cron hooks to use the new x-internal-secret header.
-- The WORKER_CRON_SECRET value is stored in Supabase Vault and read at call time,
-- so the secret never appears in pg_cron's schedule listing.

-- Store the secret in Vault if not already there. This expects the same value
-- to be present as a Supabase project secret named WORKER_CRON_SECRET; the
-- worker reads from process.env, while pg_cron reads from Vault here.
-- We seed the Vault entry with a placeholder and the user will rotate it via SQL
-- after setting the project secret. If a Vault entry already exists, leave it.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'worker_cron_secret') THEN
    PERFORM vault.create_secret(
      'CHANGE_ME_REPLACE_WITH_REAL_SECRET',
      'worker_cron_secret',
      'Shared secret for pg_cron -> /api/public/hooks/* calls'
    );
  END IF;
END $$;

-- Drop the old schedules that used the anon key.
SELECT cron.unschedule('jobpilot-heartbeat-check') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'jobpilot-heartbeat-check'
);
SELECT cron.unschedule('jobpilot-daily-summary-tick') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'jobpilot-daily-summary-tick'
);

-- Re-schedule with x-internal-secret header sourced from Vault.
SELECT cron.schedule(
  'jobpilot-heartbeat-check',
  '*/5 * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://project--ba5780a8-641e-4ee8-9c24-6e1c185cef2f.lovable.app/api/public/hooks/check-heartbeat',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'worker_cron_secret' LIMIT 1)
    ),
    body := '{}'::jsonb
  );
  $cron$
);

SELECT cron.schedule(
  'jobpilot-daily-summary-tick',
  '*/15 * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://project--ba5780a8-641e-4ee8-9c24-6e1c185cef2f.lovable.app/api/public/hooks/daily-summary',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'worker_cron_secret' LIMIT 1)
    ),
    body := '{}'::jsonb
  );
  $cron$
);