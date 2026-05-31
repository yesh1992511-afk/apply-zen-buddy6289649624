DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'run_status' AND e.enumlabel = 'success'
  ) THEN
    ALTER TYPE public.run_status ADD VALUE 'success';
  END IF;
END$$;