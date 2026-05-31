
-- 1. Remove previously stored unmatched jobs (Jobs page is matched-only from now on)
DELETE FROM public.application_events
  WHERE application_id IN (
    SELECT a.id FROM public.applications a
    JOIN public.jobs j ON j.id = a.job_id
    WHERE j.matched = false
  );
DELETE FROM public.applications
  WHERE job_id IN (SELECT id FROM public.jobs WHERE matched = false);
DELETE FROM public.logs
  WHERE job_id IN (SELECT id FROM public.jobs WHERE matched = false);
DELETE FROM public.notification_log
  WHERE job_id IN (SELECT id FROM public.jobs WHERE matched = false);
DELETE FROM public.jobs WHERE matched = false;

-- 2. Generated (tailored) resumes
CREATE TABLE public.generated_resumes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  job_id uuid NOT NULL,
  tailored_summary text,
  tailored_experiences jsonb NOT NULL DEFAULT '[]'::jsonb,
  tailored_projects jsonb NOT NULL DEFAULT '[]'::jsonb,
  tailored_skills text[] NOT NULL DEFAULT '{}'::text[],
  pdf_storage_path text,
  tex_content text,
  model text,
  tokens_in integer,
  tokens_out integer,
  cost_usd numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, job_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.generated_resumes TO authenticated;
GRANT ALL ON public.generated_resumes TO service_role;

ALTER TABLE public.generated_resumes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner full access"
  ON public.generated_resumes
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX idx_generated_resumes_user_job ON public.generated_resumes(user_id, job_id);

-- 3. Link applications to their tailored resume
ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS generated_resume_id uuid REFERENCES public.generated_resumes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_applications_generated_resume ON public.applications(generated_resume_id);
