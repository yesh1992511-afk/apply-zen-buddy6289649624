CREATE TABLE public.extension_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  token text NOT NULL UNIQUE,
  label text NOT NULL DEFAULT 'My Browser',
  last_seen_at timestamptz,
  captures_today integer NOT NULL DEFAULT 0,
  captures_total integer NOT NULL DEFAULT 0,
  last_reset_date date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_extension_tokens_user ON public.extension_tokens(user_id);
CREATE INDEX idx_extension_tokens_token ON public.extension_tokens(token);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.extension_tokens TO authenticated;
GRANT ALL ON public.extension_tokens TO service_role;

ALTER TABLE public.extension_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner full access" ON public.extension_tokens
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
