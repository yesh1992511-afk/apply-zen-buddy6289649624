
-- 0. Extend phase enum first (so the partial index can reference it)
ALTER TYPE public.application_phase ADD VALUE IF NOT EXISTS 'dead_letter';
