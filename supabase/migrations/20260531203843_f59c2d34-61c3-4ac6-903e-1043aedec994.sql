DO $$
DECLARE
  v_id uuid;
BEGIN
  SELECT id INTO v_id FROM vault.secrets WHERE name = 'worker_cron_secret' LIMIT 1;
  IF v_id IS NULL THEN
    PERFORM vault.create_secret(
      '0894ea1b2d117f9b1c383c608a7a8133b7e21979af69c1002bcb2b4c170e0e32',
      'worker_cron_secret',
      'Shared secret for pg_cron -> /api/public/hooks/* calls'
    );
  ELSE
    PERFORM vault.update_secret(
      v_id,
      '0894ea1b2d117f9b1c383c608a7a8133b7e21979af69c1002bcb2b4c170e0e32',
      'worker_cron_secret',
      'Shared secret for pg_cron -> /api/public/hooks/* calls'
    );
  END IF;
END $$;