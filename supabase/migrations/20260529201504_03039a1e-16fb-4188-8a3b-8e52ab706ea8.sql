
-- ============================================================
-- ENUMS
-- ============================================================
CREATE TYPE public.app_role AS ENUM ('owner');
CREATE TYPE public.application_status AS ENUM ('queued','applying','applied','failed','needs_review','skipped');
CREATE TYPE public.source_kind AS ENUM ('apify','rest','board');
CREATE TYPE public.log_level AS ENUM ('debug','info','warn','error');
CREATE TYPE public.run_status AS ENUM ('running','succeeded','failed');

-- ============================================================
-- USER ROLES (single owner)
-- ============================================================
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL DEFAULT 'owner',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "owner reads own role" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Block more than one auth user (single-user app)
CREATE OR REPLACE FUNCTION public.block_extra_signups()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
BEGIN
  IF (SELECT count(*) FROM auth.users) >= 1 THEN
    RAISE EXCEPTION 'Signup disabled: this is a single-user application';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER block_extra_signups_trigger
  BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.block_extra_signups();

-- Auto-assign owner role + create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'owner') ON CONFLICT DO NOTHING;
  INSERT INTO public.profile (user_id, email) VALUES (NEW.id, NEW.email) ON CONFLICT DO NOTHING;
  INSERT INTO public.automation_settings (user_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

-- ============================================================
-- PROFILE
-- ============================================================
CREATE TABLE public.profile (
  user_id uuid PRIMARY KEY,
  full_name text,
  email text,
  phone text,
  location text,
  timezone text DEFAULT 'UTC',
  linkedin_url text,
  github_url text,
  portfolio_url text,
  work_authorization text,
  requires_sponsorship boolean DEFAULT false,
  willing_to_relocate boolean DEFAULT false,
  preferred_locations text[] DEFAULT '{}',
  remote_preference text DEFAULT 'any',
  salary_min integer,
  salary_max integer,
  salary_currency text DEFAULT 'USD',
  years_experience numeric,
  headline text,
  summary text,
  cover_letter_tone text DEFAULT 'professional',
  apply_email text,
  apply_password_set boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profile TO authenticated;
GRANT ALL ON public.profile TO service_role;
ALTER TABLE public.profile ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner full access" ON public.profile FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============================================================
-- EXPERIENCES
-- ============================================================
CREATE TABLE public.experiences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  company text NOT NULL,
  title text NOT NULL,
  location text,
  start_date date,
  end_date date,
  is_current boolean DEFAULT false,
  bullets text[] DEFAULT '{}',
  tech text[] DEFAULT '{}',
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.experiences TO authenticated;
GRANT ALL ON public.experiences TO service_role;
ALTER TABLE public.experiences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner full access" ON public.experiences FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============================================================
-- PROJECTS
-- ============================================================
CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  url text,
  description text,
  bullets text[] DEFAULT '{}',
  tech text[] DEFAULT '{}',
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT ALL ON public.projects TO service_role;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner full access" ON public.projects FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============================================================
-- SKILLS
-- ============================================================
CREATE TABLE public.skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  category text,
  proficiency text,
  years numeric,
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.skills TO authenticated;
GRANT ALL ON public.skills TO service_role;
ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner full access" ON public.skills FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============================================================
-- EDUCATIONS
-- ============================================================
CREATE TABLE public.educations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  school text NOT NULL,
  degree text,
  field text,
  start_date date,
  end_date date,
  gpa text,
  notes text,
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.educations TO authenticated;
GRANT ALL ON public.educations TO service_role;
ALTER TABLE public.educations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner full access" ON public.educations FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============================================================
-- RESUMES (templates + generated)
-- ============================================================
CREATE TABLE public.resumes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL DEFAULT 'template', -- template | generated_resume | generated_cover
  name text NOT NULL,
  tex_content text,
  storage_path text,
  pdf_storage_path text,
  application_id uuid,
  markers jsonb DEFAULT '[]'::jsonb,
  is_default boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.resumes TO authenticated;
GRANT ALL ON public.resumes TO service_role;
ALTER TABLE public.resumes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner full access" ON public.resumes FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============================================================
-- SOURCES (scraping sources)
-- ============================================================
CREATE TABLE public.sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  key text NOT NULL, -- e.g. apify_linkedin, adzuna, greenhouse_board
  display_name text NOT NULL,
  kind public.source_kind NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  cadence_minutes integer NOT NULL DEFAULT 60,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_run_at timestamptz,
  last_run_status public.run_status,
  last_run_count integer,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sources TO authenticated;
GRANT ALL ON public.sources TO service_role;
ALTER TABLE public.sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner full access" ON public.sources FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============================================================
-- FILTERS
-- ============================================================
CREATE TABLE public.filters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  is_default boolean DEFAULT false,
  keywords text[] DEFAULT '{}',
  exclude_keywords text[] DEFAULT '{}',
  exclude_companies text[] DEFAULT '{}',
  locations text[] DEFAULT '{}',
  remote_only boolean DEFAULT false,
  hybrid_ok boolean DEFAULT true,
  onsite_ok boolean DEFAULT true,
  salary_min integer,
  posted_within_hours integer DEFAULT 168,
  seniority text[] DEFAULT '{}',
  employment_type text[] DEFAULT '{}',
  min_score integer DEFAULT 40,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.filters TO authenticated;
GRANT ALL ON public.filters TO service_role;
ALTER TABLE public.filters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner full access" ON public.filters FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============================================================
-- JOBS
-- ============================================================
CREATE TABLE public.jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  source_key text NOT NULL,
  source_job_id text,
  dedupe_hash text NOT NULL,
  title text NOT NULL,
  company text NOT NULL,
  location text,
  remote text,
  url text NOT NULL,
  description text,
  description_html text,
  salary_min integer,
  salary_max integer,
  salary_currency text,
  employment_type text,
  seniority text,
  posted_at timestamptz,
  scraped_at timestamptz NOT NULL DEFAULT now(),
  raw jsonb,
  matched_filter_ids uuid[] DEFAULT '{}',
  score integer DEFAULT 0,
  matched boolean DEFAULT false,
  status text DEFAULT 'new', -- new | saved | skipped | applied
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, dedupe_hash)
);
CREATE INDEX jobs_user_matched_idx ON public.jobs(user_id, matched, scraped_at DESC);
CREATE INDEX jobs_user_posted_idx ON public.jobs(user_id, posted_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jobs TO authenticated;
GRANT ALL ON public.jobs TO service_role;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner full access" ON public.jobs FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============================================================
-- APPLICATIONS
-- ============================================================
CREATE TABLE public.applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  status public.application_status NOT NULL DEFAULT 'queued',
  resume_id uuid,
  cover_letter_id uuid,
  attempts integer DEFAULT 0,
  last_error text,
  notes text,
  screenshots text[] DEFAULT '{}',
  applied_at timestamptz,
  queued_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX applications_user_status_idx ON public.applications(user_id, status, queued_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.applications TO authenticated;
GRANT ALL ON public.applications TO service_role;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner full access" ON public.applications FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============================================================
-- AUTOMATION SETTINGS
-- ============================================================
CREATE TABLE public.automation_settings (
  user_id uuid PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  run_24_7 boolean NOT NULL DEFAULT true,
  daily_start time DEFAULT '08:00',
  daily_end time DEFAULT '22:00',
  timezone text DEFAULT 'UTC',
  max_applies_per_day integer NOT NULL DEFAULT 50,
  parallelism integer NOT NULL DEFAULT 2,
  aggressiveness integer NOT NULL DEFAULT 5, -- 1..5
  exclude_companies text[] DEFAULT '{}',
  captcha_provider text DEFAULT '2captcha',
  proxy_provider text,
  ai_resume_model text DEFAULT 'openai/gpt-5',
  ai_reasoning_model text DEFAULT 'deepseek/deepseek-reasoner',
  active_filter_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automation_settings TO authenticated;
GRANT ALL ON public.automation_settings TO service_role;
ALTER TABLE public.automation_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner full access" ON public.automation_settings FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============================================================
-- AUTOMATION RUNS
-- ============================================================
CREATE TABLE public.automation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL, -- scrape | apply
  source_key text,
  status public.run_status NOT NULL DEFAULT 'running',
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  items_in integer DEFAULT 0,
  items_out integer DEFAULT 0,
  errors integer DEFAULT 0,
  metadata jsonb DEFAULT '{}'::jsonb
);
CREATE INDEX automation_runs_user_idx ON public.automation_runs(user_id, started_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automation_runs TO authenticated;
GRANT ALL ON public.automation_runs TO service_role;
ALTER TABLE public.automation_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner full access" ON public.automation_runs FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============================================================
-- LOGS
-- ============================================================
CREATE TABLE public.logs (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL,
  ts timestamptz NOT NULL DEFAULT now(),
  level public.log_level NOT NULL DEFAULT 'info',
  scope text,
  message text NOT NULL,
  job_id uuid,
  application_id uuid,
  run_id uuid,
  metadata jsonb
);
CREATE INDEX logs_user_ts_idx ON public.logs(user_id, ts DESC);
GRANT SELECT, INSERT, DELETE ON public.logs TO authenticated;
GRANT ALL ON public.logs TO service_role;
ALTER TABLE public.logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner reads logs" ON public.logs FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "owner deletes logs" ON public.logs FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ============================================================
-- SECRETS META (names only, values on VPS)
-- ============================================================
CREATE TABLE public.secrets_meta (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  category text, -- ai | apify | proxy | captcha | gmail | portal
  status text NOT NULL DEFAULT 'unset', -- unset | set | invalid
  last_checked timestamptz,
  notes text,
  UNIQUE(user_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.secrets_meta TO authenticated;
GRANT ALL ON public.secrets_meta TO service_role;
ALTER TABLE public.secrets_meta ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner full access" ON public.secrets_meta FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============================================================
-- WORKER HEARTBEAT (single row)
-- ============================================================
CREATE TABLE public.worker_heartbeat (
  user_id uuid PRIMARY KEY,
  last_seen timestamptz,
  version text,
  metadata jsonb DEFAULT '{}'::jsonb
);
GRANT SELECT, INSERT, UPDATE ON public.worker_heartbeat TO authenticated;
GRANT ALL ON public.worker_heartbeat TO service_role;
ALTER TABLE public.worker_heartbeat ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner full access" ON public.worker_heartbeat FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============================================================
-- updated_at trigger helper
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER profile_updated BEFORE UPDATE ON public.profile FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER experiences_updated BEFORE UPDATE ON public.experiences FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER projects_updated BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER sources_updated BEFORE UPDATE ON public.sources FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER filters_updated BEFORE UPDATE ON public.filters FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER applications_updated BEFORE UPDATE ON public.applications FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER automation_settings_updated BEFORE UPDATE ON public.automation_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- New user trigger (after table creation)
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- STORAGE BUCKETS
-- ============================================================
INSERT INTO storage.buckets (id, name, public) VALUES ('resumes','resumes', false) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('screenshots','screenshots', false) ON CONFLICT DO NOTHING;

CREATE POLICY "owner reads resumes" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'resumes' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "owner writes resumes" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'resumes' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "owner updates resumes" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'resumes' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "owner deletes resumes" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'resumes' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "owner reads screenshots" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'screenshots' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "owner writes screenshots" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'screenshots' AND auth.uid()::text = (storage.foldername(name))[1]);
