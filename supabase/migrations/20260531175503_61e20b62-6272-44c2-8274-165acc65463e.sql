ALTER TABLE public.profile
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name  TEXT;

UPDATE public.profile
SET first_name = COALESCE(first_name, NULLIF(split_part(trim(full_name), ' ', 1), '')),
    last_name  = COALESCE(
      last_name,
      NULLIF(trim(substring(trim(full_name) FROM position(' ' IN trim(full_name)) + 1)), '')
    )
WHERE full_name IS NOT NULL AND trim(full_name) <> '';