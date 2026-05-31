
ALTER TABLE public.profile
  ADD COLUMN IF NOT EXISTS consent_background_check boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS consent_drug_test boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS criminal_record_disclosure text,
  ADD COLUMN IF NOT EXISTS notice_period_category text,
  ADD COLUMN IF NOT EXISTS relocation_assistance_needed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS travel_willingness_pct integer,
  ADD COLUMN IF NOT EXISTS references_available_on_request boolean DEFAULT true;

ALTER TABLE public.profile
  DROP CONSTRAINT IF EXISTS profile_criminal_record_disclosure_chk;
ALTER TABLE public.profile
  ADD CONSTRAINT profile_criminal_record_disclosure_chk
  CHECK (criminal_record_disclosure IS NULL OR criminal_record_disclosure IN ('none','disclosed','decline'));

ALTER TABLE public.profile
  DROP CONSTRAINT IF EXISTS profile_notice_period_category_chk;
ALTER TABLE public.profile
  ADD CONSTRAINT profile_notice_period_category_chk
  CHECK (notice_period_category IS NULL OR notice_period_category IN ('immediate','2w','1m','2m','3m','other'));

ALTER TABLE public.profile
  DROP CONSTRAINT IF EXISTS profile_travel_willingness_pct_chk;
ALTER TABLE public.profile
  ADD CONSTRAINT profile_travel_willingness_pct_chk
  CHECK (travel_willingness_pct IS NULL OR travel_willingness_pct IN (0,25,50,75,100));
