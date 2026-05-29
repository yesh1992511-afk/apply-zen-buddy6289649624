
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'owner') ON CONFLICT DO NOTHING;
  INSERT INTO public.profile (user_id, email) VALUES (NEW.id, NEW.email) ON CONFLICT DO NOTHING;
  INSERT INTO public.automation_settings (user_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;

  -- Seed default sources (disabled — user enables after configuring queries)
  INSERT INTO public.sources (user_id, key, display_name, kind, enabled, cadence_minutes, config) VALUES
    (NEW.id, 'apify:linkedin', 'LinkedIn (via Apify)', 'apify', false, 120,
     '{"queries":["software engineer"],"locations":["United States"],"remote":true,"rows":100}'::jsonb),
    (NEW.id, 'apify:ziprecruiter', 'ZipRecruiter (via Apify)', 'apify', false, 180,
     '{"queries":["software engineer"],"locations":["United States"],"rows":100}'::jsonb),
    (NEW.id, 'apify:google_jobs', 'Google Jobs (via Apify)', 'apify', false, 240,
     '{"queries":["software engineer remote"],"locations":["United States"],"rows":100}'::jsonb),
    (NEW.id, 'remoteok', 'RemoteOK (free API)', 'rss', false, 60, '{}'::jsonb),
    (NEW.id, 'weworkremotely', 'We Work Remotely (free RSS)', 'rss', false, 60, '{}'::jsonb),
    (NEW.id, 'arbeitnow', 'Arbeitnow (free API)', 'rss', false, 60, '{}'::jsonb)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$function$;
