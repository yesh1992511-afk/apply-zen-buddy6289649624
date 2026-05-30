
-- Phase: Profile expansion for autofill
ALTER TABLE public.profile
  ADD COLUMN IF NOT EXISTS preferred_name text,
  ADD COLUMN IF NOT EXISTS pronouns text,
  ADD COLUMN IF NOT EXISTS date_of_birth date,
  ADD COLUMN IF NOT EXISTS nationality text,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS state_region text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS postal_code text,
  ADD COLUMN IF NOT EXISTS street_address text,
  ADD COLUMN IF NOT EXISTS address_line_2 text,
  ADD COLUMN IF NOT EXISTS work_auth_country text,
  ADD COLUMN IF NOT EXISTS visa_status text,
  ADD COLUMN IF NOT EXISTS visa_expiry date,
  ADD COLUMN IF NOT EXISTS needs_visa_now boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS needs_visa_future boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS authorized_countries text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS gender text,
  ADD COLUMN IF NOT EXISTS ethnicity text,
  ADD COLUMN IF NOT EXISTS veteran_status text,
  ADD COLUMN IF NOT EXISTS disability_status text,
  ADD COLUMN IF NOT EXISTS lgbtq_status text,
  ADD COLUMN IF NOT EXISTS share_demographics boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS desired_salary integer,
  ADD COLUMN IF NOT EXISTS salary_period text DEFAULT 'yearly',
  ADD COLUMN IF NOT EXISTS current_salary integer,
  ADD COLUMN IF NOT EXISTS notice_period_weeks integer,
  ADD COLUMN IF NOT EXISTS earliest_start_date date,
  ADD COLUMN IF NOT EXISTS available_hours_per_week integer,
  ADD COLUMN IF NOT EXISTS open_to_contract boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS open_to_fulltime boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS open_to_parttime boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS open_to_internship boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS desired_titles text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS desired_industries text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS excluded_industries text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS travel_willingness text,
  ADD COLUMN IF NOT EXISTS shift_preference text,
  ADD COLUMN IF NOT EXISTS security_clearance text,
  ADD COLUMN IF NOT EXISTS drivers_license boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_own_transport boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_passport boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS passport_country text,
  ADD COLUMN IF NOT EXISTS linkedin_username text,
  ADD COLUMN IF NOT EXISTS twitter_url text,
  ADD COLUMN IF NOT EXISTS stackoverflow_url text,
  ADD COLUMN IF NOT EXISTS personal_website text,
  ADD COLUMN IF NOT EXISTS dribbble_url text,
  ADD COLUMN IF NOT EXISTS behance_url text,
  ADD COLUMN IF NOT EXISTS medium_url text,
  ADD COLUMN IF NOT EXISTS screening_answers jsonb DEFAULT '{}'::jsonb;

-- Languages
CREATE TABLE IF NOT EXISTS public.languages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  proficiency text,
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.languages TO authenticated;
GRANT ALL ON public.languages TO service_role;
ALTER TABLE public.languages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner full access" ON public.languages FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Certifications
CREATE TABLE IF NOT EXISTS public.certifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  issuer text,
  issued_date date,
  expiry_date date,
  credential_id text,
  url text,
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.certifications TO authenticated;
GRANT ALL ON public.certifications TO service_role;
ALTER TABLE public.certifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner full access" ON public.certifications FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- References
CREATE TABLE IF NOT EXISTS public.references_list (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  relationship text,
  company text,
  email text,
  phone text,
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.references_list TO authenticated;
GRANT ALL ON public.references_list TO service_role;
ALTER TABLE public.references_list ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner full access" ON public.references_list FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
