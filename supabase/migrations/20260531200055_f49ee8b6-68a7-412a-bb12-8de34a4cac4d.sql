
-- 1) Prevent duplicate active applications for the same job
CREATE UNIQUE INDEX IF NOT EXISTS applications_user_job_active_uniq
  ON public.applications (user_id, job_id)
  WHERE status IN ('queued', 'applying', 'needs_review');

-- 2) Auto-queue trigger: when a job becomes matched, create an application row
CREATE OR REPLACE FUNCTION public.auto_queue_matched_job()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exists boolean;
  v_enabled boolean;
BEGIN
  -- Only act on matched jobs with a real URL
  IF NEW.matched IS NOT TRUE OR NEW.url IS NULL THEN
    RETURN NEW;
  END IF;

  -- On UPDATE, only fire when matched flips from false->true OR status flips to 'matched'
  IF TG_OP = 'UPDATE' THEN
    IF (OLD.matched IS TRUE) AND (OLD.status = NEW.status) THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Only auto-queue when user has automation enabled
  SELECT enabled INTO v_enabled
    FROM public.automation_settings
   WHERE user_id = NEW.user_id;
  IF NOT COALESCE(v_enabled, false) THEN
    RETURN NEW;
  END IF;

  -- Skip if any application already exists for this job (any status)
  SELECT EXISTS (
    SELECT 1 FROM public.applications
     WHERE user_id = NEW.user_id AND job_id = NEW.id
  ) INTO v_exists;
  IF v_exists THEN
    RETURN NEW;
  END IF;

  -- Insert queued application (enforce_apply_quota trigger still applies)
  BEGIN
    INSERT INTO public.applications (user_id, job_id, status, phase, queued_at)
    VALUES (NEW.user_id, NEW.id, 'queued', 'discovered', now());
  EXCEPTION
    WHEN check_violation THEN
      -- Daily quota hit — silently skip, will be queued tomorrow if still relevant
      NULL;
    WHEN unique_violation THEN
      NULL;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_queue_matched_job ON public.jobs;
CREATE TRIGGER trg_auto_queue_matched_job
  AFTER INSERT OR UPDATE OF matched, status ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_queue_matched_job();
