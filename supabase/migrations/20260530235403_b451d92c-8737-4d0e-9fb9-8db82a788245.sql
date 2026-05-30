ALTER TABLE public.automation_settings
  ADD COLUMN IF NOT EXISTS target_titles text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS target_locations text[] NOT NULL DEFAULT '{United States}',
  ADD COLUMN IF NOT EXISTS target_country text NOT NULL DEFAULT 'US',
  ADD COLUMN IF NOT EXISTS target_posted_within_hours integer NOT NULL DEFAULT 168,
  ADD COLUMN IF NOT EXISTS target_exclude_keywords text[] NOT NULL DEFAULT '{}';