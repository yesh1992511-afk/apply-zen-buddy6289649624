
-- ============================================================
-- Hardening migration: FK cascades, uniques, indexes, validation
-- ============================================================

-- 1) CASCADE FKs to auth.users on every user_id column
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'profile','experiences','projects','skills','educations',
    'resumes','sources','filters','jobs','applications',
    'automation_settings','automation_runs','logs','secrets_meta',
    'user_roles','worker_heartbeat'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format(
      'ALTER TABLE public.%I
        ADD CONSTRAINT %I FOREIGN KEY (user_id)
        REFERENCES auth.users(id) ON DELETE CASCADE',
      t, t || '_user_id_fkey'
    );
  END LOOP;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2) Uniques
CREATE UNIQUE INDEX IF NOT EXISTS jobs_user_dedupe_uniq
  ON public.jobs(user_id, dedupe_hash);

CREATE UNIQUE INDEX IF NOT EXISTS applications_user_job_uniq
  ON public.applications(user_id, job_id);

CREATE UNIQUE INDEX IF NOT EXISTS sources_user_key_uniq
  ON public.sources(user_id, key);

CREATE UNIQUE INDEX IF NOT EXISTS filters_one_default_per_user
  ON public.filters(user_id) WHERE is_default = true;

-- 3) Hot-path indexes
CREATE INDEX IF NOT EXISTS jobs_user_posted_idx
  ON public.jobs(user_id, posted_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS jobs_user_status_idx
  ON public.jobs(user_id, status);
CREATE INDEX IF NOT EXISTS jobs_user_scraped_idx
  ON public.jobs(user_id, scraped_at DESC);
CREATE INDEX IF NOT EXISTS applications_user_status_idx
  ON public.applications(user_id, status);
CREATE INDEX IF NOT EXISTS applications_user_queued_idx
  ON public.applications(user_id, queued_at DESC);
CREATE INDEX IF NOT EXISTS logs_user_ts_idx
  ON public.logs(user_id, ts DESC);
CREATE INDEX IF NOT EXISTS logs_run_idx
  ON public.logs(run_id) WHERE run_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS automation_runs_user_started_idx
  ON public.automation_runs(user_id, started_at DESC);

-- 4) updated_at triggers wherever the column exists
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'profile','experiences','projects','filters','sources',
    'automation_settings','applications','jobs'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at_trg ON public.%I', t);
    EXECUTE format(
      'CREATE TRIGGER set_updated_at_trg BEFORE UPDATE ON public.%I
       FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', t
    );
  END LOOP;
END $$;

-- 5) Validation trigger for automation_settings (replaces CHECK to stay flexible)
CREATE OR REPLACE FUNCTION public.validate_automation_settings()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.aggressiveness < 1 OR NEW.aggressiveness > 5 THEN
    RAISE EXCEPTION 'aggressiveness must be between 1 and 5';
  END IF;
  IF NEW.parallelism < 1 OR NEW.parallelism > 10 THEN
    RAISE EXCEPTION 'parallelism must be between 1 and 10';
  END IF;
  IF NEW.max_applies_per_day < 1 OR NEW.max_applies_per_day > 500 THEN
    RAISE EXCEPTION 'max_applies_per_day must be between 1 and 500';
  END IF;
  IF NEW.run_24_7 = false AND NEW.daily_start IS NOT NULL AND NEW.daily_end IS NOT NULL
     AND NEW.daily_start >= NEW.daily_end THEN
    RAISE EXCEPTION 'daily_start must be before daily_end when not running 24/7';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS validate_automation_settings_trg ON public.automation_settings;
CREATE TRIGGER validate_automation_settings_trg
  BEFORE INSERT OR UPDATE ON public.automation_settings
  FOR EACH ROW EXECUTE FUNCTION public.validate_automation_settings();

-- 6) Validation for filters
CREATE OR REPLACE FUNCTION public.validate_filter()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.min_score IS NOT NULL AND (NEW.min_score < 0 OR NEW.min_score > 100) THEN
    RAISE EXCEPTION 'min_score must be between 0 and 100';
  END IF;
  IF NEW.posted_within_hours IS NOT NULL AND NEW.posted_within_hours < 1 THEN
    RAISE EXCEPTION 'posted_within_hours must be >= 1';
  END IF;
  IF NEW.name IS NULL OR length(trim(NEW.name)) = 0 THEN
    RAISE EXCEPTION 'filter name is required';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS validate_filter_trg ON public.filters;
CREATE TRIGGER validate_filter_trg
  BEFORE INSERT OR UPDATE ON public.filters
  FOR EACH ROW EXECUTE FUNCTION public.validate_filter();

-- 7) Allow service_role to write logs (worker writes via service role)
GRANT INSERT ON public.logs TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.logs_id_seq TO service_role;
