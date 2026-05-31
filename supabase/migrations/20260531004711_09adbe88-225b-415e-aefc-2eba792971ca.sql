-- Cover letters table
CREATE TABLE public.cover_letters (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'template' CHECK (kind IN ('template','generated')),
  body TEXT NOT NULL DEFAULT '',
  job_id UUID,
  tone TEXT DEFAULT 'professional',
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cover_letters TO authenticated;
GRANT ALL ON public.cover_letters TO service_role;

ALTER TABLE public.cover_letters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner full access" ON public.cover_letters
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER cover_letters_updated_at
  BEFORE UPDATE ON public.cover_letters
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_cover_letters_user ON public.cover_letters(user_id);
CREATE INDEX idx_cover_letters_job ON public.cover_letters(job_id) WHERE job_id IS NOT NULL;

-- Idempotency unique index on applications
CREATE UNIQUE INDEX IF NOT EXISTS applications_idempotency_uniq
  ON public.applications(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Indexes for hot paths
CREATE INDEX IF NOT EXISTS idx_jobs_user_matched_score
  ON public.jobs(user_id, matched, score DESC);

CREATE INDEX IF NOT EXISTS idx_applications_user_phase
  ON public.applications(user_id, phase);

CREATE INDEX IF NOT EXISTS idx_application_events_app_ts
  ON public.application_events(application_id, ts DESC);